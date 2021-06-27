import { surroundingAgent } from '../engine.mjs';
import {
  Q, X,
  Await,
  Completion,
  EnsureCompletion,
  NormalCompletion,
  AbruptCompletion,
} from '../completion.mjs';
import { Evaluate } from '../evaluator.mjs';
import { Value, Type } from '../value.mjs';
import { resume, handleInResume } from '../helpers.mjs';
import {
  Assert,
  Call,
  CreateBuiltinFunction,
  CreateIterResultObject,
  GetGeneratorKind,
  NewPromiseCapability,
  PerformPromiseThen,
  PromiseResolve,
} from './all.mjs';

// This file covers abstract operations defined in
// 25.5 #sec-asyncgenerator-objects

// 25.5.3.1 #sec-asyncgeneratorrequest-records
class AsyncGeneratorRequestRecord {
  constructor(completion, promiseCapability) {
    this.Completion = completion;
    this.Capability = promiseCapability;
  }
}

// 25.5.3.2 #sec-asyncgeneratorstart
export function AsyncGeneratorStart(generator, generatorBody) {
  // Assert: generator is an AsyncGenerator instance.
  Assert(generator.AsyncGeneratorState === Value.undefined);
  const genContext = surroundingAgent.runningExecutionContext;
  genContext.Generator = generator;
  genContext.codeEvaluationState = (function* resumer() {
    const result = EnsureCompletion(yield* Evaluate(generatorBody));
    // Assert: If we return here, the async generator either threw an exception or performed either an implicit or explicit return.
    surroundingAgent.executionContextStack.pop(genContext);
    generator.AsyncGeneratorState = 'completed';
    let resultValue;
    if (result instanceof NormalCompletion) {
      resultValue = Value.undefined;
    } else {
      resultValue = result.Value;
      if (result.Type !== 'return') {
        return X(AsyncGeneratorReject(generator, resultValue));
      }
    }
    return X(AsyncGeneratorResolve(generator, resultValue, Value.true));
  }());
  generator.AsyncGeneratorContext = genContext;
  generator.AsyncGeneratorState = 'suspendedStart';
  generator.AsyncGeneratorQueue = [];
  return Value.undefined;
}

// 25.5.3.3 #sec-asyncgeneratorresolve
function AsyncGeneratorResolve(generator, value, done) {
  // Assert: generator is an AsyncGenerator instance.
  const queue = generator.AsyncGeneratorQueue;
  Assert(queue.length > 0);
  const next = queue.shift();
  const promiseCapability = next.Capability;
  const iteratorResult = X(CreateIterResultObject(value, done));
  X(Call(promiseCapability.Resolve, Value.undefined, [iteratorResult]));
  X(AsyncGeneratorResumeNext(generator));
  return Value.undefined;
}

// 25.5.3.4 #sec-asyncgeneratorreject
function AsyncGeneratorReject(generator, exception) {
  // Assert: generator is an AsyncGenerator instance.
  const queue = generator.AsyncGeneratorQueue;
  Assert(queue.length > 0);
  const next = queue.shift();
  const promiseCapability = next.Capability;
  X(Call(promiseCapability.Reject, Value.undefined, [exception]));
  X(AsyncGeneratorResumeNext(generator));
  return Value.undefined;
}

// 25.5.3.5.1 #async-generator-resume-next-return-processor-fulfilled
function AsyncGeneratorResumeNextReturnProcessorFulfilledFunctions([value = Value.undefined]) {
  // 1. Let F be the active function object.
  const F = surroundingAgent.activeFunctionObject;
  // 2. Set F.[[Generator]].[[AsyncGeneratorState]] to completed.
  F.Generator.AsyncGeneratorState = 'completed';
  // 3. Return ! AsyncGeneratorResolve(F.[[Generator]], value, true).
  return X(AsyncGeneratorResolve(F.Generator, value, Value.true));
}

// 25.5.3.5.2 #async-generator-resume-next-return-processor-rejected
function AsyncGeneratorResumeNextReturnProcessorRejectedFunctions([reason = Value.undefined]) {
  // 1. Let F be the active function object.
  const F = surroundingAgent.activeFunctionObject;
  // 2. Set F.[[Generator]].[[AsyncGeneratorState]] to completed.
  F.Generator.AsyncGeneratorState = 'completed';
  // 3. Return ! AsyncGeneratorReject(F.[[Generator]], reason).
  return X(AsyncGeneratorReject(F.Generator, reason));
}

// 25.5.3.5 #sec-asyncgeneratorresumenext
function AsyncGeneratorResumeNext(generator) {
  // 1. Assert: generator is an AsyncGenerator instance.
  // 2. Let state be generator.[[AsyncGeneratorState]].
  let state = generator.AsyncGeneratorState;
  // 3. Assert: state is not executing.
  Assert(state !== 'executing');
  // 4. If state is awaiting-return, return undefined.
  if (state === 'awaiting-return') {
    return Value.undefined;
  }
  // 5. Let queue be generator.[[AsyncGeneratorQueue]].
  const queue = generator.AsyncGeneratorQueue;
  // 6. If queue is an empty List, return undefined.
  if (queue.length === 0) {
    return Value.undefined;
  }
  // 7. Let next be the value of the first element of queue.
  const next = queue[0];
  // 8. Assert: next is an AsyncGeneratorRequest record.
  Assert(next instanceof AsyncGeneratorRequestRecord);
  // 9. Let completion be next.[[Completion]].
  const completion = next.Completion;
  // 10. If completion is an abrupt completion, then
  if (completion instanceof AbruptCompletion) {
    // a. If state is suspendedStart, then
    if (state === 'suspendedStart') {
      // i. Set generator.[[AsyncGeneratorState]] to completed.
      generator.AsyncGeneratorState = 'completed';
      // ii. Set state to completed.
      state = 'completed';
    }
    // b. If state is completed, then
    if (state === 'completed') {
      // i. If completion.[[Type]] is return, then
      if (completion.Type === 'return') {
        // 1. Set generator.[[AsyncGeneratorState]] to awaiting-return.
        generator.AsyncGeneratorState = 'awaiting-return';
        // 2. Let promise be ? PromiseResolve(%Promise%, completion.[[Value]]).
        const promise = Q(PromiseResolve(surroundingAgent.intrinsic('%Promise%'), completion.Value));
        // 3. Let stepsFulfilled be the algorithm steps defined in AsyncGeneratorResumeNext Return Processor Fulfilled Functions.
        const stepsFulfilled = AsyncGeneratorResumeNextReturnProcessorFulfilledFunctions;
        // 4. Let lengthFulfilled be the number of non-optional parameters of the function definition in AsyncGeneratorResumeNext Return Processor Fulfilled Functions.
        const lengthFulfilled = 1;
        // 5. Let onFulfilled be ! CreateBuiltinFunction(stepsFulfilled, lengthFulfilled, "", « [[Generator]] »).
        const onFulfilled = X(CreateBuiltinFunction(stepsFulfilled, lengthFulfilled, new Value(''), ['Generator']));
        // 6. Set onFulfilled.[[Generator]] to generator.
        onFulfilled.Generator = generator;
        // 7. Let stepsRejected be the algorithm steps defined in AsyncGeneratorResumeNext Return Processor Rejected Functions.
        const stepsRejected = AsyncGeneratorResumeNextReturnProcessorRejectedFunctions;
        // 8. Let lengthRejected be the number of non-optional parameters of the function definition in AsyncGeneratorResumeNext Return Processor Rejected Functions.
        const lengthRejected = 1;
        // 9. Let onRejected be ! CreateBuiltinFunction(stepsRejected, lengthRejected, "", « [[Generator]] »).
        const onRejected = X(CreateBuiltinFunction(stepsRejected, lengthRejected, new Value(''), ['Generator']));
        // 10. Set onRejected.[[Generator]] to generator.
        onRejected.Generator = generator;
        // 11. Perform ! PerformPromiseThen(promise, onFulfilled, onRejected).
        X(PerformPromiseThen(promise, onFulfilled, onRejected));
        // 12. Return undefined.
        return Value.undefined;
      } else { // ii . Else,
        // 1. Assert: completion.[[Type]] is throw.
        Assert(completion.Type === 'throw');
        // 2. Perform ! AsyncGeneratorReject(generator, completion.[[Value]]).
        X(AsyncGeneratorReject(generator, completion.Value));
        // 3. Return undefined.
        return Value.undefined;
      }
    }
  } else if (state === 'completed') { // 11. Else if state is completed, return ! AsyncGeneratorResolve(generator, undefined, true).
    return X(AsyncGeneratorResolve(generator, Value.undefined, Value.true));
  }
  // 12. Assert: state is either suspendedStart or suspendedYield.
  Assert(state === 'suspendedStart' || state === 'suspendedYield');
  // 13. Let genContext be generator.[[AsyncGeneratorContext]].
  const genContext = generator.AsyncGeneratorContext;
  // 14. Let callerContext be the running execution context.
  const callerContext = surroundingAgent.runningExecutionContext;
  // 15. Suspend callerContext.
  // 16. Set generator.[[AsyncGeneratorState]] to executing.
  generator.AsyncGeneratorState = 'executing';
  // 17. Push genContext onto the execution context stack; genContext is now the running execution context.
  surroundingAgent.executionContextStack.push(genContext);
  // 18. Resume the suspended evaluation of genContext using completion as the result of the operation that suspended it. Let result be the completion record returned by the resumed computation.
  const result = resume(genContext, completion);
  // 19. Assert: result is never an abrupt completion.
  Assert(!(result instanceof AbruptCompletion));
  // 20. Assert: When we return here, genContext has already been removed from the execution context stack and callerContext is the currently running execution context.
  Assert(surroundingAgent.runningExecutionContext === callerContext);
  // 21. Return undefined.
  return Value.undefined;
}

// 25.5.3.6 #sec-asyncgeneratorenqueue
export function AsyncGeneratorEnqueue(generator, completion) {
  Assert(completion instanceof Completion);
  const promiseCapability = X(NewPromiseCapability(surroundingAgent.intrinsic('%Promise%')));
  if (Type(generator) !== 'Object' || !('AsyncGeneratorState' in generator)) {
    const badGeneratorError = surroundingAgent.Throw('TypeError', 'NotATypeObject', 'AsyncGenerator', generator).Value;
    X(Call(promiseCapability.Reject, Value.undefined, [badGeneratorError]));
    return promiseCapability.Promise;
  }
  const queue = generator.AsyncGeneratorQueue;
  const request = new AsyncGeneratorRequestRecord(completion, promiseCapability);
  queue.push(request);
  const state = generator.AsyncGeneratorState;
  if (state !== 'executing') {
    X(AsyncGeneratorResumeNext(generator));
  }
  return promiseCapability.Promise;
}

// #sec-asyncgeneratoryield
export function* AsyncGeneratorYield(value) {
  // 1. Let genContext be the running execution context.
  const genContext = surroundingAgent.runningExecutionContext;
  // 2. Assert: genContext is the execution context of a generator.
  Assert(genContext.Generator !== Value.undefined);
  // 3. Let generator be the value of the Generator component of genContext.
  const generator = genContext.Generator;
  // 4. Assert: GetGeneratorKind() is async.
  Assert(GetGeneratorKind() === 'async');
  // 5. Set value to ? Await(value).
  value = Q(yield* Await(value));
  // 6. Set generator.[[AsyncGeneratorState]] to suspendedYield.
  generator.AsyncGeneratorState = 'suspendedYield';
  // 7. Remove genContext from the execution context stack and restore the execution context that is at the top of the execution context stack as the running execution context.
  surroundingAgent.executionContextStack.pop(genContext);
  // 8. Set the code evaluation state of genContext such that when evaluation is resumed with a Completion resumptionValue the following steps will be performed:
  const resumptionValue = EnsureCompletion(yield handleInResume(AsyncGeneratorResolve, generator, value, Value.false));

  // a. If resumptionValue.[[Type]] is not return, return Completion(resumptionValue).
  if (resumptionValue.Type !== 'return') {
    return Completion(resumptionValue);
  }
  // b. Let awaited be Await(resumptionValue.[[Value]]).
  const awaited = EnsureCompletion(yield* Await(resumptionValue.Value));
  // c. If awaited.[[Type]] is throw, return Completion(awaited).
  if (awaited.Type === 'throw') {
    return Completion(awaited);
  }
  // d. Assert: awaited.[[Type]] is normal.
  Assert(awaited.Type === 'normal');
  // e. Return Completion { [[Type]]: return, [[Value]]: awaited.[[Value]], [[Target]]: empty }.
  return new Completion({ Type: 'return', Value: awaited.Value, Target: undefined });
  // f. NOTE: When one of the above steps returns, it returns to the evaluation of the YieldExpression production that originally called this abstract operation.

  // 9. Return ! AsyncGeneratorResolve(generator, value, false).
  // 10. NOTE: This returns to the evaluation of the operation that had most previously resumed evaluation of genContext.
}
