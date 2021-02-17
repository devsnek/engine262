import { surroundingAgent } from './engine.mjs';
import { Type, Value } from './value.mjs';
import {
  RequireInternalSlot,
  StackFramePositionRecord,
  StackFrameRecord,
  StackFrameSpanRecord,
  ToString,
} from './abstract-ops/all.mjs';
import { X, AwaitFulfilledFunctions } from './completion.mjs';

export const kInternal = Symbol('kInternal');

function convertValueForKey(key) {
  if (typeof key === 'string') {
    return Symbol.for(`engine262_helper_key_${key}`);
  }
  switch (Type(key)) {
    case 'String':
      return key.stringValue();
    case 'Number':
      return key.numberValue();
    default:
      return key;
  }
}

export class ValueMap {
  constructor() {
    this.map = new Map();
  }

  get size() {
    return this.map.size;
  }

  get(key) {
    return this.map.get(convertValueForKey(key));
  }

  set(key, value) {
    this.map.set(convertValueForKey(key), value);
    return this;
  }

  has(key) {
    return this.map.has(convertValueForKey(key));
  }

  delete(key) {
    return this.map.delete(convertValueForKey(key));
  }

  * keys() {
    for (const [key] of this.entries()) {
      yield key;
    }
  }

  entries() {
    return this[Symbol.iterator]();
  }

  forEach(cb) {
    for (const [key, value] of this.entries()) {
      cb(value, key, this);
    }
  }

  * [Symbol.iterator]() {
    for (const [key, value] of this.map.entries()) {
      if (typeof key === 'string' || typeof key === 'number') {
        yield [new Value(key), value];
      } else {
        yield [key, value];
      }
    }
  }

  mark(m) {
    for (const [k, v] of this.entries()) {
      m(k);
      m(v);
    }
  }
}

export class ValueSet {
  constructor(init) {
    this.set = new Set();
    if (init !== undefined && init !== null) {
      for (const item of init) {
        this.add(item);
      }
    }
  }

  get size() {
    return this.set.size;
  }

  add(item) {
    this.set.add(convertValueForKey(item));
    return this;
  }

  has(item) {
    return this.set.has(convertValueForKey(item));
  }

  delete(item) {
    return this.set.delete(convertValueForKey(item));
  }

  values() {
    return this[Symbol.iterator]();
  }

  * [Symbol.iterator]() {
    for (const key of this.set.values()) {
      if (typeof key === 'string' || typeof key === 'number') {
        yield new Value(key);
      } else {
        yield key;
      }
    }
  }

  mark(m) {
    for (const v of this.values()) {
      m(v);
    }
  }
}

export class OutOfRange extends RangeError {
  /* c8 ignore next */
  constructor(fn, detail) {
    super(`${fn}() argument out of range`);
    this.detail = detail;
  }
}

export function unwind(iterator, maxSteps = 1) {
  let steps = 0;
  while (true) {
    const { done, value } = iterator.next('Unwind');
    if (done) {
      return value;
    }
    /* c8 ignore next */
    steps += 1;
    if (steps > maxSteps) {
      throw new RangeError('Max steps exceeded');
    }
  }
}

const kSafeToResume = Symbol('kSameToResume');

export function handleInResume(fn, ...args) {
  const bound = () => fn(...args);
  bound[kSafeToResume] = true;
  return bound;
}

export function resume(context, completion) {
  const { value } = context.codeEvaluationState.next(completion);
  if (typeof value === 'function' && value[kSafeToResume] === true) {
    return X(value());
  }
  return value;
}

export class CallSite {
  constructor(context) {
    this.context = context;
    this.lastNode = null;
    this.constructCall = false;
  }

  clone(context = this.context) {
    const c = new CallSite(context);
    c.lastNode = this.lastNode;
    c.constructCall = this.constructCall;
    return c;
  }

  isTopLevel() {
    return this.context.Function === Value.null;
  }

  isConstructCall() {
    return this.constructCall;
  }

  isAsync() {
    if (this.context.Function !== Value.null && this.context.Function.ECMAScriptCode) {
      const code = this.context.Function.ECMAScriptCode;
      return code.type === 'AsyncFunctionBody' || code.type === 'AsyncGeneratorBody';
    }
    return false;
  }

  isNative() {
    return !!this.context.Function.nativeFunction;
  }

  getFunctionName() {
    if (this.context.Function !== Value.null) {
      const name = this.context.Function.properties.get(new Value('name'));
      if (name) {
        return X(ToString(name.Value)).stringValue();
      }
    }
    return null;
  }

  getSpecifier() {
    if (this.context.ScriptOrModule !== Value.null) {
      return this.context.ScriptOrModule.HostDefined.specifier;
    }
    return null;
  }

  setLocation(node) {
    this.lastNode = node;
  }

  get lineNumber() {
    if (this.lastNode) {
      return this.lastNode.location.start.line;
    }
    return null;
  }

  get columnNumber() {
    if (this.lastNode) {
      return this.lastNode.location.start.column;
    }
    return null;
  }

  loc() {
    if (this.isNative()) {
      return 'native';
    }
    let out = '';
    const specifier = this.getSpecifier();
    if (specifier) {
      out += specifier;
    } else {
      out += '<anonymous>';
    }
    if (this.lineNumber !== null) {
      out += `:${this.lineNumber}`;
      if (this.columnNumber !== null) {
        out += `:${this.columnNumber}`;
      }
    }
    return out.trim();
  }

  toStackFrameRecord() {
    const isAsync = this.isAsync();
    const functionName = this.getFunctionName();
    const isConstructCall = this.isConstructCall();
    const isMethodCall = !isConstructCall && !this.isTopLevel();

    let name = isAsync ? 'async ' : '';
    let source = '';
    let span;

    if (isConstructCall) {
      name += 'new ';
    }

    if (isMethodCall || isConstructCall) {
      if (functionName) {
        name += functionName;
      } else {
        name += '<anonymous>';
      }
    } else if (functionName) {
      name += functionName;
    }

    if (this.isNative()) {
      source = 'native';
    } else {
      const specifier = this.getSpecifier();
      if (this.lastNode) {
        if (specifier) {
          source = `${specifier}:`;
        }

        const { start } = this.lastNode.location;
        span = new StackFrameSpanRecord({
          StartPosition: new StackFramePositionRecord({
            Line: start.line,
            Column: start.column,
          }),
        });
      } else if (specifier) {
        source = specifier;
      } else {
        source = '<anonymous>';
      }
    }

    return new StackFrameRecord({
      Name: name,
      Source: source,
      Span: span,
      callSite: this,
    });
  }

  toString() {
    const isAsync = this.isAsync();
    const functionName = this.getFunctionName();
    const isConstructCall = this.isConstructCall();
    const isMethodCall = !isConstructCall && !this.isTopLevel();

    let string = isAsync ? 'async ' : '';

    if (isConstructCall) {
      string += 'new ';
    }

    if (isMethodCall || isConstructCall) {
      if (functionName) {
        string += functionName;
      } else {
        string += '<anonymous>';
      }
    } else if (functionName) {
      string += functionName;
    } else {
      return `${string}${this.loc()}`;
    }

    return `${string} (${this.loc()})`;
  }
}

function captureAsyncStack(stack) {
  let promise = stack[0].context.promiseCapability.Promise;
  for (let i = 0; i < 10; i += 1) {
    if (promise.PromiseFulfillReactions.length !== 1) {
      return;
    }
    const [reaction] = promise.PromiseFulfillReactions;
    if (reaction.Handler && reaction.Handler.Callback.nativeFunction === AwaitFulfilledFunctions) {
      const asyncContext = reaction.Handler.Callback.AsyncContext;
      stack.push(asyncContext.callSite.clone());
      if ('PromiseState' in asyncContext.promiseCapability.Promise) {
        promise = asyncContext.promiseCapability.Promise;
      } else {
        return;
      }
    } else if (reaction.Capability !== Value.undefined) {
      if ('PromiseState' in reaction.Capability.Promise) {
        promise = reaction.Capability.Promise;
      } else {
        return;
      }
    }
  }
}

export function captureStack(O) {
  X(RequireInternalSlot(O, 'ErrorData'));

  const stack = [];
  for (let i = surroundingAgent.executionContextStack.length - 2; i >= 0; i -= 1) {
    const e = surroundingAgent.executionContextStack[i];
    if (e.VariableEnvironment === undefined && e.Function === Value.null) {
      break;
    }
    stack.push(e.callSite.clone());
    if (e.callSite.isAsync()) {
      i -= 1; // skip original execution context which has no useful information.
    }
  }

  if (stack.length > 0 && stack[0].context.promiseCapability) {
    captureAsyncStack(stack);
  }

  O.ErrorData = stack.map((callSite) => callSite.toStackFrameRecord());
}
