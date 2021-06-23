import { surroundingAgent } from './engine.mjs';
import {
  Assert,
  CreateBuiltinFunction,
  PerformPromiseThen,
  PromiseResolve,
} from './abstract-ops/all.mjs';
import { Value } from './value.mjs';
import { resume } from './helpers.mjs';

// #sec-completion-record-specification-type
export function Completion(init) {
  if (new.target === undefined) {
    // 1. Assert: completionRecord is a Completion Record.
    Assert(init instanceof Completion);
    // 2. Return completionRecord as the Completion Record of this abstract operation.
    return init;
  }

  this.Type = init.Type;
  this.Value = init.Value;
  this.Target = init.Target;
}

// NON-SPEC
Completion.prototype.mark = function mark(m) {
  m(this.Value);
};

// #sec-normalcompletion
export function NormalCompletion(argument) {
  // 1. Return Completion { [[Type]]: normal, [[Value]]: argument, [[Target]]: empty }.
  return new Completion({ Type: 'normal', Value: argument, Target: undefined });
}

Object.defineProperty(NormalCompletion, Symbol.hasInstance, {
  value: function hasInstance(v) {
    return v instanceof Completion && v.Type === 'normal';
  },
  writable: true,
  enumerable: false,
  configurable: true,
});

export class AbruptCompletion {
  static [Symbol.hasInstance](v) {
    return v instanceof Completion && v.Type !== 'normal';
  }
}

// #sec-throwcompletion
export function ThrowCompletion(argument) {
  // 1. Return Completion { [[Type]]: throw, [[Value]]: argument, [[Target]]: empty }.
  return new Completion({ Type: 'throw', Value: argument, Target: undefined });
}

// 6.2.3.4 #sec-updateempty
export function UpdateEmpty(completionRecord, value) {
  Assert(completionRecord instanceof Completion);
  // 1. Assert: If completionRecord.[[Type]] is either return or throw, then completionRecord.[[Value]] is not empty.
  Assert(!(completionRecord.Type === 'return' || completionRecord.Type === 'throw') || completionRecord.Value !== undefined);
  // 2. If completionRecord.[[Value]] is not empty, return Completion(completionRecord).
  if (completionRecord.Value !== undefined) {
    return Completion(completionRecord);
  }
  // 3. Return Completion { [[Type]]: completionRecord.[[Type]], [[Value]]: value, [[Target]]: completionRecord.[[Target]] }.
  return new Completion({ Type: completionRecord.Type, Value: value, Target: completionRecord.Target });
}

// #sec-returnifabrupt
export function ReturnIfAbrupt() {
  /* c8 skip next */
  throw new TypeError('ReturnIfAbrupt requires build');
}

// #sec-returnifabrupt-shorthands ? OperationName()
export const Q = ReturnIfAbrupt;

// #sec-returnifabrupt-shorthands ! OperationName()
export function X() {
  /* c8 skip next */
  throw new TypeError('X() requires build');
}

// 25.6.1.1.1 #sec-ifabruptrejectpromise
export function IfAbruptRejectPromise() {
  /* c8 skip next */
  throw new TypeError('IfAbruptRejectPromise requires build');
}

export function EnsureCompletion(val) {
  if (val instanceof Completion) {
    return val;
  }
  return NormalCompletion(val);
}

export function AwaitFulfilledFunctions([value]) {
  const F = surroundingAgent.activeFunctionObject;
  const asyncContext = F.AsyncContext;
  const prevContext = surroundingAgent.runningExecutionContext;
  // Suspend prevContext
  surroundingAgent.executionContextStack.push(asyncContext);
  resume(asyncContext, NormalCompletion(value));
  Assert(surroundingAgent.runningExecutionContext === prevContext);
  return Value.undefined;
}

function AwaitRejectedFunctions([reason]) {
  const F = surroundingAgent.activeFunctionObject;
  const asyncContext = F.AsyncContext;
  const prevContext = surroundingAgent.runningExecutionContext;
  // Suspend prevContext
  surroundingAgent.executionContextStack.push(asyncContext);
  resume(asyncContext, ThrowCompletion(reason));
  Assert(surroundingAgent.runningExecutionContext === prevContext);
  return Value.undefined;
}

export function* Await(value) {
  const asyncContext = surroundingAgent.runningExecutionContext;
  const promise = Q(PromiseResolve(surroundingAgent.intrinsic('%Promise%'), value));
  const stepsFulfilled = AwaitFulfilledFunctions;
  const lengthFulfilled = 1;
  const onFulfilled = X(CreateBuiltinFunction(stepsFulfilled, lengthFulfilled, new Value(''), ['AsyncContext']));
  onFulfilled.AsyncContext = asyncContext;
  const stepsRejected = AwaitRejectedFunctions;
  const lengthRejected = 1;
  const onRejected = X(CreateBuiltinFunction(stepsRejected, lengthRejected, new Value(''), ['AsyncContext']));
  onRejected.AsyncContext = asyncContext;
  X(PerformPromiseThen(promise, onFulfilled, onRejected));
  surroundingAgent.executionContextStack.pop(asyncContext);
  const completion = yield Value.undefined;
  return completion;
}
