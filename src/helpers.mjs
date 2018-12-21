import { surroundingAgent } from './engine.mjs';
import { Value, Descriptor } from './value.mjs';
import { ToString, DefinePropertyOrThrow } from './abstract-ops/all.mjs';
import { X } from './completion.mjs';
import { inspect } from './api.mjs';

export class OutOfRange extends RangeError {
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

export function captureStack(O) {
  const stack = surroundingAgent.executionContextStack
    .slice(0, -1) // remove current Error constructor frame
    .filter((e) => e.Function !== Value.null)
    .map((e) => {
      const name = e.Function.properties.get(new Value('name'));
      if (name) {
        return `\n  at ${X(ToString(name.Value)).stringValue()}`;
      }
      return '\n  at <anonymous>';
    })
    .reverse();

  const errorString = X(ToString(O)).stringValue();
  const trace = `${errorString}${stack.join('')}`;

  X(DefinePropertyOrThrow(O, new Value('stack'), Descriptor({
    Value: new Value(trace),
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.false,
  })));
}

function inlineInspect(V) {
  return inspect(V, surroundingAgent.currentRealmRecord, true);
}

const messages = {
  NotAFunction: (v) => `${inlineInspect(v)} is not a function`,
  NotAConstructor: (v) => `${inlineInspect(v)} is not a constructor`,
  NotAnObject: (v) => `${inlineInspect(v)} is not an object`,
  NotATypeObject: (t, v) => `${inlineInspect(v)} is not a ${t} object`,
  PromiseResolveFunction: (v) => `Promise resolve function ${inlineInspect(v)} is not callable`,
  PromiseRejectFunction: (v) => `Promise reject function ${inlineInspect(v)} is not callable`,
  ProxyRevoked: (n) => `Cannot perform '${n}' on a proxy that has been revoked`,
  BufferDetachKeyMismatch: (k, b) => `${inlineInspect(k)} is not the [[ArrayBufferDetachKey]] of ${inlineInspect(b)}`,
  BufferDetached: () => 'Cannot operate on detached ArrayBuffer',
  TypedArrayTooSmall: () => 'Derived TypedArray constructor created an array which was too small',
  NotDefined: (n) => `${inlineInspect(n)} is not defined`,
  CannotSetProperty: (p) => `Cannot set property ${inlineInspect(p)}`,
  AlreadyDeclared: (n) => `${inlineInspect(n)} is already declared`,
  ConstructorRequiresNew: (n) => `${n} constructor requires new`,
  TypedArrayOffsetAlignment: (n, m) => `Start offset of ${n} should be a multiple of ${m}`,
  TypedArrayCreationOOB: () => 'Sum of start offset and byte length should be less than the size of underlying buffer',
  TypedArrayLengthAlignment: (n, m) => `Size of ${n} should be a multiple of ${m}`,
};

export function msg(key, ...args) {
  return messages[key](...args);
}
