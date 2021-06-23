import {
  surroundingAgent,
} from '../engine.mjs';
import {
  Descriptor,
  Type,
  Value,
  wellKnownSymbols,
} from '../value.mjs';
import {
  Assert,
  Call,
  CreateArrayFromList,
  CreateBuiltinFunction,
  CreateDataProperty,
  CreateResolvingFunctions,
  DefinePropertyOrThrow,
  Get,
  GetIterator,
  Invoke,
  IsCallable,
  IsConstructor,
  IteratorClose,
  IteratorStep,
  IteratorValue,
  NewPromiseCapability,
  OrdinaryObjectCreate,
  OrdinaryCreateFromConstructor,
  PromiseCapabilityRecord,
  PromiseResolve,
} from '../abstract-ops/all.mjs';
import {
  AbruptCompletion, Completion,
  ThrowCompletion,
  IfAbruptRejectPromise,
  ReturnIfAbrupt,
  EnsureCompletion,
  Q, X,
} from '../completion.mjs';
import { bootstrapConstructor } from './bootstrap.mjs';

// #sec-promise-executor
function PromiseConstructor([executor = Value.undefined], { NewTarget }) {
  // 1. If NewTarget is undefined, throw a TypeError exception.
  if (NewTarget === Value.undefined) {
    return surroundingAgent.Throw('TypeError', 'ConstructorNonCallable', this);
  }
  // 2. If IsCallable(executor) is false, throw a TypeError exception.
  if (IsCallable(executor) === Value.false) {
    return surroundingAgent.Throw('TypeError', 'NotAFunction', executor);
  }
  // 3. Let promise be ? OrdinaryCreateFromConstructor(NewTarget, "%Promise.prototype%", « [[PromiseState]], [[PromiseResult]], [[PromiseFulfillReactions]], [[PromiseRejectReactions]], [[PromiseIsHandled]] »).
  const promise = Q(OrdinaryCreateFromConstructor(NewTarget, '%Promise.prototype%', [
    'PromiseState',
    'PromiseResult',
    'PromiseFulfillReactions',
    'PromiseRejectReactions',
    'PromiseIsHandled',
  ]));
  // 4. Set promise.[[PromiseState]] to pending.
  promise.PromiseState = 'pending';
  // 5. Set promise.[[PromiseFulfillReactions]] to a new empty List.
  promise.PromiseFulfillReactions = [];
  // 6. Set promise.[[PromiseFulfillReactions]] to a new empty List.
  promise.PromiseRejectReactions = [];
  // 7. Set promise.[[PromiseIsHandled]] to false.
  promise.PromiseIsHandled = Value.false;
  // 8. Let resolvingFunctions be CreateResolvingFunctions(promise).
  const resolvingFunctions = CreateResolvingFunctions(promise);
  // 9. Let completion be Call(executor, undefined, « resolvingFunctions.[[Resolve]], resolvingFunctions.[[Reject]] »).
  const completion = Call(executor, Value.undefined, [
    resolvingFunctions.Resolve, resolvingFunctions.Reject,
  ]);
  // 10. If completion is an abrupt completion, then
  if (completion instanceof AbruptCompletion) {
    // a. Perform ? Call(resolvingFunctions.[[Reject]], undefined, « completion.[[Value]] »).
    Q(Call(resolvingFunctions.Reject, Value.undefined, [completion.Value]));
  }
  // 11. Return promise.
  return promise;
}

// #sec-promise.all-resolve-element-functions
function PromiseAllResolveElementFunctions([x = Value.undefined]) {
  const F = surroundingAgent.activeFunctionObject;
  const alreadyCalled = F.AlreadyCalled;
  if (alreadyCalled.Value === true) {
    return Value.undefined;
  }
  alreadyCalled.Value = true;
  const index = F.Index;
  const values = F.Values;
  const promiseCapability = F.Capability;
  const remainingElementsCount = F.RemainingElements;
  values[index] = x;
  remainingElementsCount.Value -= 1;
  if (remainingElementsCount.Value === 0) {
    const valuesArray = CreateArrayFromList(values);
    return Q(Call(promiseCapability.Resolve, Value.undefined, [valuesArray]));
  }
  return Value.undefined;
}

// #sec-getpromiseresolve
function GetPromiseResolve(promiseConstructor) {
  // 1. Assert: IsConstructor(promiseConstructor) is true.
  Assert(IsConstructor(promiseConstructor) === Value.true);
  // 2. Let promiseResolve be ? Get(promiseConstructor, "resolve").
  const promiseResolve = Q(Get(promiseConstructor, new Value('resolve')));
  // 3. If IsCallable(promiseResolve) is false, throw a TypeError exception.
  if (IsCallable(promiseResolve) === Value.false) {
    return surroundingAgent.Throw('TypeError', 'NotAFunction', promiseResolve);
  }
  // 4. Return promiseResolve.
  return promiseResolve;
}

// #sec-performpromiseall
function PerformPromiseAll(iteratorRecord, constructor, resultCapability, promiseResolve) {
  // 1. Assert: IsConstructor(constructor) is true.
  Assert(IsConstructor(constructor) === Value.true);
  // 2. Assert: resultCapability is a PromiseCapability Record.
  Assert(resultCapability instanceof PromiseCapabilityRecord);
  // 3. Assert: IsCallable(promiseResolve) is true.
  Assert(IsCallable(promiseResolve) === Value.true);
  // 4. Let values be a new empty List.
  const values = [];
  // 5. Let remainingElementsCount be the Record { [[Value]]: 1 }.
  const remainingElementsCount = { Value: 1 };
  // 6. Let index be 0.
  let index = 0;
  // 7. Repeat,
  while (true) {
    // a. Let next be IteratorStep(iteratorRecord).
    const next = IteratorStep(iteratorRecord);
    // b. If next is an abrupt completion, set iteratorRecord.[[Done]] to true.
    if (next instanceof AbruptCompletion) {
      iteratorRecord.Done = Value.true;
    }
    // c. ReturnIfAbrupt(next).
    ReturnIfAbrupt(next);
    // d. If next is false, then
    if (next === Value.false) {
      // i. Set iteratorRecord.[[Done]] to true.
      iteratorRecord.Done = Value.true;
      // ii. Set remainingElementsCount.[[Value]] to remainingElementsCount.[[Value]] - 1.
      remainingElementsCount.Value -= 1;
      // iii. If remainingElementsCount.[[Value]] is 0, then
      if (remainingElementsCount.Value === 0) {
        // 1. Let valuesArray be ! CreateArrayFromList(values).
        const valuesArray = CreateArrayFromList(values);
        // 2. Perform ? Call(resultCapability.[[Resolve]], undefined, « valuesArray »).
        Q(Call(resultCapability.Resolve, Value.undefined, [valuesArray]));
      }
      // iv. Return resultCapability.[[Promise]].
      return resultCapability.Promise;
    }
    // e. Let nextValue be IteratorValue(next).
    const nextValue = IteratorValue(next);
    // f. If nextValue is an abrupt completion, set iteratorRecord.[[Done]] to true.
    if (nextValue instanceof AbruptCompletion) {
      iteratorRecord.Done = Value.true;
    }
    // g. ReturnIfAbrupt(nextValue).
    ReturnIfAbrupt(nextValue);
    // h. Append undefined to values.
    values.push(Value.undefined);
    // i. Let nextPromise be ? Call(promiseResolve, constructor, « nextValue »).
    const nextPromise = Q(Call(promiseResolve, constructor, [nextValue]));
    // j. Let steps be the algorithm steps defined in Promise.all Resolve Element Functions.
    const steps = PromiseAllResolveElementFunctions;
    // k. Let length be the number of non-optional parameters of the function definition in Promise.all Resolve Element Functions.
    const length = 1;
    // l. Let onFulfilled be ! CreateBuiltinFunction(steps, length, "", « [[AlreadyCalled]], [[Index]], [[Values]], [[Capability]], [[RemainingElements]] »).
    const onFulfilled = X(CreateBuiltinFunction(steps, length, new Value(''), [
      'AlreadyCalled', 'Index', 'Values', 'Capability', 'RemainingElements',
    ]));
    // m. Set onFulfilled.[[AlreadyCalled]] to the Record { [[Value]]: false }.
    onFulfilled.AlreadyCalled = { Value: false };
    // n. Set onFulfilled.[[Index]] to index.
    onFulfilled.Index = index;
    // o. Set onFulfilled.[[Values]] to values.
    onFulfilled.Values = values;
    // p. Set onFulfilled.[[Capability]] to resultCapability.
    onFulfilled.Capability = resultCapability;
    // q. Set onFulfilled.[[RemainingElements]] to remainingElementsCount.
    onFulfilled.RemainingElements = remainingElementsCount;
    // r. Set remainingElementsCount.[[Value]] to remainingElementsCount.[[Value]] + 1.
    remainingElementsCount.Value += 1;
    // s. Perform ? Invoke(nextPromise, "then", « onFulfilled, resultCapability.[[Reject]] »).
    Q(Invoke(nextPromise, new Value('then'), [onFulfilled, resultCapability.Reject]));
    // t. Set index to index + 1.
    index += 1;
  }
}

// #sec-promise.all
function Promise_all([iterable = Value.undefined], { thisValue }) {
  // 1. Let C be the this value.
  const C = thisValue;
  // 2. Let promiseCapability be ? NewPromiseCapability(C).
  const promiseCapability = Q(NewPromiseCapability(C));
  // 3. Let promiseResolve be GetPromiseResolve(C).
  const promiseResolve = GetPromiseResolve(C);
  // 4. IfAbruptRejectPromise(promiseResolve, promiseCapability).
  IfAbruptRejectPromise(promiseResolve, promiseCapability);
  // 5. Let iteratorRecord be GetIterator(iterable).
  const iteratorRecord = GetIterator(iterable);
  // 6. IfAbruptRejectPromise(iteratorRecord, promiseCapability).
  IfAbruptRejectPromise(iteratorRecord, promiseCapability);
  // 7. Let result be PerformPromiseAll(iteratorRecord, C, promiseCapability, promiseResolve).
  let result = EnsureCompletion(PerformPromiseAll(iteratorRecord, C, promiseCapability, promiseResolve));
  // 8. If result is an abrupt completion, then
  if (result instanceof AbruptCompletion) {
    // a. If iteratorRecord.[[Done]] is false, set result to IteratorClose(iteratorRecord, result).
    if (iteratorRecord.Done === Value.false) {
      result = IteratorClose(iteratorRecord, result);
    }
    // b. IfAbruptRejectPromise(result, promiseCapability).
    IfAbruptRejectPromise(result, promiseCapability);
  }
  // 9. Return Completion(result).
  return Completion(result);
}

function PromiseAllSettledResolveElementFunctions([x = Value.undefined]) {
  const F = surroundingAgent.activeFunctionObject;
  const alreadyCalled = F.AlreadyCalled;
  if (alreadyCalled.Value === true) {
    return Value.undefined;
  }
  alreadyCalled.Value = true;
  const index = F.Index;
  const values = F.Values;
  const promiseCapability = F.Capability;
  const remainingElementsCount = F.RemainingElements;
  const obj = X(OrdinaryObjectCreate(surroundingAgent.intrinsic('%Object.prototype%')));
  X(CreateDataProperty(obj, new Value('status'), new Value('fulfilled')));
  X(CreateDataProperty(obj, new Value('value'), x));
  values[index] = obj;
  remainingElementsCount.Value -= 1;
  if (remainingElementsCount.Value === 0) {
    const valuesArray = X(CreateArrayFromList(values));
    return Q(Call(promiseCapability.Resolve, Value.undefined, [valuesArray]));
  }
  return Value.undefined;
}

function PromiseAllSettledRejectElementFunctions([x = Value.undefined]) {
  const F = surroundingAgent.activeFunctionObject;
  const alreadyCalled = F.AlreadyCalled;
  if (alreadyCalled.Value === true) {
    return Value.undefined;
  }
  alreadyCalled.Value = true;
  const index = F.Index;
  const values = F.Values;
  const promiseCapability = F.Capability;
  const remainingElementsCount = F.RemainingElements;
  const obj = X(OrdinaryObjectCreate(surroundingAgent.intrinsic('%Object.prototype%')));
  X(CreateDataProperty(obj, new Value('status'), new Value('rejected')));
  X(CreateDataProperty(obj, new Value('reason'), x));
  values[index] = obj;
  remainingElementsCount.Value -= 1;
  if (remainingElementsCount.Value === 0) {
    const valuesArray = X(CreateArrayFromList(values));
    return Q(Call(promiseCapability.Resolve, Value.undefined, [valuesArray]));
  }
  return Value.undefined;
}

// #sec-performpromiseallsettled
function PerformPromiseAllSettled(iteratorRecord, constructor, resultCapability, promiseResolve) {
  // 1. Assert: ! IsConstructor(constructor) is true.
  Assert(X(IsConstructor(constructor) === Value.true));
  // 2. Assert: resultCapability is a PromiseCapability Record.
  Assert(resultCapability instanceof PromiseCapabilityRecord);
  // 3. Assert: IsCallable(promiseResolve) is true.
  Assert(IsCallable(promiseResolve) === Value.true);
  // 4. Let values be a new empty List.
  const values = [];
  // 5. Let remainingElementsCount be the Record { [[Value]]: 1 }.
  const remainingElementsCount = { Value: 1 };
  // 6. Let index be 0.
  let index = 0;
  // 7. Repeat,
  while (true) {
    // a. Let next be IteratorStep(iteratorRecord).
    const next = IteratorStep(iteratorRecord);
    // b. Let next be IteratorStep(iteratorRecord).
    if (next instanceof AbruptCompletion) {
      iteratorRecord.Done = Value.true;
    }
    // c. ReturnIfAbrupt(next).
    ReturnIfAbrupt(next);
    // d. If next is false,
    if (next === Value.false) {
      // i. Set iteratorRecord.[[Done]] to true.
      iteratorRecord.Done = Value.true;
      // ii. Set remainingElementsCount.[[Value]] to remainingElementsCount.[[Value]] - 1.
      remainingElementsCount.Value -= 1;
      // iii. If remainingElementsCount.[[Value]] is 0, then
      if (remainingElementsCount.Value === 0) {
        // 1. Let valuesArray be ! CreateArrayFromList(values).
        const valuesArray = X(CreateArrayFromList(values));
        // 2. Perform ? Call(resultCapability.[[Resolve]], undefined, « valuesArray »).
        Q(Call(resultCapability.Resolve, Value.undefined, [valuesArray]));
      }
      // iv. Return resultCapability.[[Promise]].
      return resultCapability.Promise;
    }
    // e. Let nextValue be IteratorValue(next).
    const nextValue = IteratorValue(next);
    // f. If nextValue is an abrupt completion, set iteratorRecord.[[Done]] to true.
    if (nextValue instanceof AbruptCompletion) {
      iteratorRecord.Done = Value.true;
    }
    // g. ReturnIfAbrupt(nextValue).
    ReturnIfAbrupt(nextValue);
    // h. Append undefined to values.
    values.push(Value.undefined);
    // i. Let nextPromise be ? Call(promiseResolve, constructor, « nextValue »).
    const nextPromise = Q(Call(promiseResolve, constructor, [nextValue]));
    // j. Let stepsFulfilled be the algorithm steps defined in Promise.allSettled Resolve Element Functions.
    const stepsFulfilled = PromiseAllSettledResolveElementFunctions;
    // k. Let lengthFulfilled be the number of non-optional parameters of the function definition in Promise.allSettled Resolve Element Functions.
    const lengthFulfilled = 1;
    // l. Let onFulfilled be ! CreateBuiltinFunction(stepsFulfilled, lengthFulfilled, "", « [[AlreadyCalled]], [[Index]], [[Values]], [[Capability]], [[RemainingElements]] »).
    const onFulfilled = X(CreateBuiltinFunction(stepsFulfilled, lengthFulfilled, new Value(''), [
      'AlreadyCalled',
      'Index',
      'Values',
      'Capability',
      'RemainingElements',
    ]));
    // m. Let alreadyCalled be the Record { [[Value]]: false }.
    const alreadyCalled = { Value: false };
    // n. Set onFulfilled.[[AlreadyCalled]] to alreadyCalled.
    onFulfilled.AlreadyCalled = alreadyCalled;
    // o. Set onFulfilled.[[Index]] to index.
    onFulfilled.Index = index;
    // p. Set onFulfilled.[[Values]] to values.
    onFulfilled.Values = values;
    // q. Set onFulfilled.[[Capability]] to resultCapability.
    onFulfilled.Capability = resultCapability;
    // r. Set onFulfilled.[[RemainingElements]] to remainingElementsCount.
    onFulfilled.RemainingElements = remainingElementsCount;
    // s. Let rejectSteps be the algorithm steps defined in Promise.allSettled Reject Element Functions.
    const stepsRejected = PromiseAllSettledRejectElementFunctions;
    // t. Let lengthRejected be the number of non-optional parameters of the function definition in Promise.allSettled Reject Element Functions.
    const lengthRejected = 1;
    // u. Let onRejected be ! CreateBuiltinFunction(stepsRejected, lengthRejected, "", « [[AlreadyCalled]], [[Index]], [[Values]], [[Capability]], [[RemainingElements]] »).
    const onRejected = X(CreateBuiltinFunction(stepsRejected, lengthRejected, new Value(''), [
      'AlreadyCalled',
      'Index',
      'Values',
      'Capability',
      'RemainingElements',
    ]));
    // v. Set onRejected.[[AlreadyCalled]] to alreadyCalled.
    onRejected.AlreadyCalled = alreadyCalled;
    // w. Set onRejected.[[Index]] to index.
    onRejected.Index = index;
    // x. Set onRejected.[[Values]] to values.
    onRejected.Values = values;
    // y. Set onRejected.[[Capability]] to resultCapability.
    onRejected.Capability = resultCapability;
    // z. Set onRejected.[[RemainingElements]] to remainingElementsCount.
    onRejected.RemainingElements = remainingElementsCount;
    // aa. Set remainingElementsCount.[[Value]] to remainingElementsCount.[[Value]] + 1.
    remainingElementsCount.Value += 1;
    // ab. Perform ? Invoke(nextPromise, "then", « onFulfilled, onRejected »).
    Q(Invoke(nextPromise, new Value('then'), [onFulfilled, onRejected]));
    // ac. Set index to index + 1.
    index += 1;
  }
}

// #sec-promise.allsettled
function Promise_allSettled([iterable = Value.undefined], { thisValue }) {
  // 1. Let C be the this value.
  const C = thisValue;
  // 2. Let promiseCapability be ? NewPromiseCapability(C).
  const promiseCapability = Q(NewPromiseCapability(C));
  // 3. Let promiseResolve be GetPromiseResolve(C).
  const promiseResolve = GetPromiseResolve(C);
  // 4. IfAbruptRejectPromise(promiseResolve, promiseCapability).
  IfAbruptRejectPromise(promiseResolve, promiseCapability);
  // 5. Let iteratorRecord be GetIterator(iterable).
  const iteratorRecord = GetIterator(iterable);
  // 6. IfAbruptRejectPromise(iteratorRecord, promiseCapability).
  IfAbruptRejectPromise(iteratorRecord, promiseCapability);
  // 7. Let result be PerformPromiseAllSettled(iteratorRecord, C, promiseCapability, promiseResolve).
  let result = EnsureCompletion(PerformPromiseAllSettled(iteratorRecord, C, promiseCapability, promiseResolve));
  // 8. If result is an abrupt completion, then
  if (result instanceof AbruptCompletion) {
    // a. If iteratorRecord.[[Done]] is false, set result to IteratorClose(iteratorRecord, result).
    if (iteratorRecord.Done === Value.false) {
      result = IteratorClose(iteratorRecord, result);
    }
    // b. IfAbruptRejectPromise(result, promiseCapability).
    IfAbruptRejectPromise(result, promiseCapability);
  }
  // 9. Return Completion(result).
  return Completion(result);
}

// #sec-promise.any-reject-element-functions
function PromiseAnyRejectElementFunctions([x = Value.undefined]) {
  // 1. Let F be the active function object.
  const F = surroundingAgent.activeFunctionObject;
  // 2. Let alreadyCalled be F.[[AlreadyCalled]].
  const alreadyCalled = F.AlreadyCalled;
  // 3. If alreadyCalled.[[Value]] is true, return undefined.
  if (alreadyCalled.Value) {
    return Value.undefined;
  }
  // 4. Set alreadyCalled.[[Value]] to true.
  alreadyCalled.Value = true;
  // 5. Let index be F.[[Index]].
  const index = F.Index;
  // 6. Let errors be F.[[Errors]].
  const errors = F.Errors;
  // 7. Let promiseCapability be F.[[Capability]].
  const promiseCapability = F.Capability;
  // 8. Let remainingElementsCount be F.[[RemainingElements]].
  const remainingElementsCount = F.RemainingElements;
  // 9. Set errors[index] to x.
  errors[index] = x;
  // 10. Set remainingElementsCount.[[Value]] to remainingElementsCount.[[Value]] - 1.
  remainingElementsCount.Value -= 1;
  // 11. If remainingElementsCount.[[Value]] is 0, then
  if (remainingElementsCount.Value === 0) {
    // a. Let error be a newly created AggregateError object.
    const error = surroundingAgent.Throw('AggregateError', 'PromiseAnyRejected').Value;
    // b. Perform ! DefinePropertyOrThrow(error, "errors", Property Descriptor { [[Configurable]]: true, [[Enumerable]]: false, [[Writable]]: true, [[Value]]: errors }).
    X(DefinePropertyOrThrow(error, new Value('errors'), Descriptor({
      Configurable: Value.true,
      Enumerable: Value.false,
      Writable: Value.true,
      Value: X(CreateArrayFromList(errors)),
    })));
    // c. Return ? Call(promiseCapability.[[Reject]], undefined, « error »).
    return Q(Call(promiseCapability.Reject, Value.undefined, [error]));
  }
  // 12. Return undefined.
  return Value.undefined;
}

// #sec-performpromiseany
function PerformPromiseAny(iteratorRecord, constructor, resultCapability, promiseResolve) {
  // 1. Assert: ! IsConstructor(constructor) is true.
  Assert(X(IsConstructor(constructor)) === Value.true);
  // 2. Assert: resultCapability is a PromiseCapability Record.
  Assert(resultCapability instanceof PromiseCapabilityRecord);
  // 3. Assert: ! IsCallable(promiseResolve) is true.
  Assert(X(IsCallable(promiseResolve)) === Value.true);
  // 4. Let errors be a new empty List.
  const errors = [];
  // 5. Let remainingElementsCount be a new Record { [[Value]]: 1 }.
  const remainingElementsCount = { Value: 1 };
  // 6. Let index be 0.
  let index = 0;
  // 7. Repeat,
  while (true) {
    // a. Let next be IteratorStep(iteratorRecord).
    const next = IteratorStep(iteratorRecord);
    // b. If next is an abrupt completion, set iteratorRecord.[[Done]] to true.
    if (next instanceof AbruptCompletion) {
      iteratorRecord.Done = Value.true;
    }
    // c. ReturnIfAbrupt(next).
    ReturnIfAbrupt(next);
    // d. If next is false, then
    if (next === Value.false) {
      // i. Set iteratorRecord.[[Done]] to true.
      iteratorRecord.Done = Value.true;
      // ii. Set remainingElementsCount.[[Value]] to remainingElementsCount.[[Value]] - 1.
      remainingElementsCount.Value -= 1;
      // iii. If remainingElementsCount.[[Value]] is 0, then
      if (remainingElementsCount.Value === 0) {
        // 1. Let error be a newly created AggregateError object.
        const error = surroundingAgent.Throw('AggregateError', 'PromiseAnyRejected').Value;
        // 2. Perform ! DefinePropertyOrThrow(error, "errors", Property Descriptor { [[Configurable]]: true, [[Enumerable]]: false, [[Writable]]: true, [[Value]]: errors }).
        X(DefinePropertyOrThrow(error, new Value('errors'), Descriptor({
          Configurable: Value.true,
          Enumerable: Value.false,
          Writable: Value.true,
          Value: X(CreateArrayFromList(errors)),
        })));
        // 3. Return ThrowCompletion(error).
        return ThrowCompletion(error);
      }
      // iv. Return resultCapability.[[Promise]].
      return resultCapability.Promise;
    }
    // e. Let nextValue be IteratorValue(next).
    const nextValue = IteratorValue(next);
    // f. If nextValue is an abrupt completion, set iteratorRecord.[[Done]] to true.
    if (nextValue instanceof AbruptCompletion) {
      iteratorRecord.Done = Value.true;
    }
    // g. ReturnIfAbrupt(nextValue).
    ReturnIfAbrupt(nextValue);
    // h. Append undefined to errors.
    errors.push(Value.undefined);
    // i. Let nextPromise be ? Call(promiseResolve, constructor, « nextValue »).
    const nextPromise = Q(Call(promiseResolve, constructor, [nextValue]));
    // j. Let stepsRejected be the algorithm steps defined in Promise.any Reject Element Functions.
    const stepsRejected = PromiseAnyRejectElementFunctions;
    // k. Let lengthRejected be the number of non-optional parameters of the function definition in Promise.any Reject Element Functions.
    const lengthRejected = 1;
    // l. Let onRejected be ! CreateBuiltinFunction(stepsRejected, lengthRejected, "", « [[AlreadyCalled]], [[Index]], [[Errors]], [[Capability]], [[RemainingElements]] »).
    const onRejected = X(CreateBuiltinFunction(stepsRejected, lengthRejected, new Value(''), ['AlreadyCalled', 'Index', 'Errors', 'Capability', 'RemainingElements']));
    // m. Set onRejected.[[AlreadyCalled]] to a new Record { [[Value]]: false }.
    onRejected.AlreadyCalled = { Value: false };
    // n. Set onRejected.[[Index]] to index.
    onRejected.Index = index;
    // o. Set onRejected.[[Errors]] to errors.
    onRejected.Errors = errors;
    // p. Set onRejected.[[Capability]] to resultCapability.
    onRejected.Capability = resultCapability;
    // q. Set onRejected.[[RemainingElements]] to remainingElementsCount.
    onRejected.RemainingElements = remainingElementsCount;
    // r. Set remainingElementsCount.[[Value]] to remainingElementsCount.[[Value]] + 1.
    remainingElementsCount.Value += 1;
    // s. Perform ? Invoke(nextPromise, "then", « resultCapability.[[Resolve]], onRejected »).
    Q(Invoke(nextPromise, new Value('then'), [resultCapability.Resolve, onRejected]));
    // t. Increase index by 1.
    index += 1;
  }
}

// #sec-promise.any
function Promise_any([iterable = Value.undefined], { thisValue }) {
  // 1. Let C be the this value.
  const C = thisValue;
  // 2. Let promiseCapability be ? NewPromiseCapability(C).
  const promiseCapability = Q(NewPromiseCapability(C));
  // 3. Let promiseResolve be GetPromiseResolve(C).
  const promiseResolve = GetPromiseResolve(C);
  // 4. IfAbruptRejectPromise(promiseResolve, promiseCapability).
  IfAbruptRejectPromise(promiseResolve, promiseCapability);
  // 5. Let iteratorRecord be GetIterator(iterable).
  const iteratorRecord = GetIterator(iterable);
  // 6. IfAbruptRejectPromise(iteratorRecord, promiseCapability).
  IfAbruptRejectPromise(iteratorRecord, promiseCapability);
  // 7. Let result be PerformPromiseAny(iteratorRecord, C, promiseCapability).
  let result = EnsureCompletion(PerformPromiseAny(iteratorRecord, C, promiseCapability, promiseResolve));
  // 8. If result is an abrupt completion, then
  if (result instanceof AbruptCompletion) {
    // a. If iteratorRecord.[[Done]] is false, set result to IteratorClose(iteratorRecord, result).
    if (iteratorRecord.Done === Value.false) {
      result = IteratorClose(iteratorRecord, result);
    }
    // b. IfAbruptRejectPromise(result, promiseCapability).
    IfAbruptRejectPromise(result, promiseCapability);
  }
  // 9. Return Completion(result).
  return Completion(result);
}

function PerformPromiseRace(iteratorRecord, constructor, resultCapability, promiseResolve) {
  // 1. Assert: IsConstructor(constructor) is true.
  Assert(IsConstructor(constructor) === Value.true);
  // 2. Assert: resultCapability is a PromiseCapability Record.
  Assert(resultCapability instanceof PromiseCapabilityRecord);
  // 3. Assert: IsCallable(promiseResolve) is true.
  Assert(IsCallable(promiseResolve) === Value.true);
  // 4. Repeat,
  while (true) {
    // a. Let next be IteratorStep(iteratorRecord).
    const next = IteratorStep(iteratorRecord);
    // b. If next is an abrupt completion, set iteratorRecord.[[Done]] to true.
    if (next instanceof AbruptCompletion) {
      iteratorRecord.Done = Value.true;
    }
    // c. ReturnIfAbrupt(next).
    ReturnIfAbrupt(next);
    // d. If next is false, then
    if (next === Value.false) {
      // i. Set iteratorRecord.[[Done]] to true.
      iteratorRecord.Done = Value.true;
      // ii. Return resultCapability.[[Promise]].
      return resultCapability.Promise;
    }
    // e. Let nextValue be IteratorValue(next).
    const nextValue = IteratorValue(next);
    // f. If nextValue is an abrupt completion, set iteratorRecord.[[Done]] to true.
    if (nextValue instanceof AbruptCompletion) {
      iteratorRecord.Done = Value.true;
    }
    // g. ReturnIfAbrupt(nextValue).
    ReturnIfAbrupt(nextValue);
    // h. Let nextPromise be ? Call(promiseResolve, constructor, « nextValue »).
    const nextPromise = Q(Call(promiseResolve, constructor, [nextValue]));
    // i. Perform ? Invoke(nextPromise, "then", « resultCapability.[[Resolve]], resultCapability.[[Reject]] »).
    Q(Invoke(nextPromise, new Value('then'), [resultCapability.Resolve, resultCapability.Reject]));
  }
}

// #sec-promise.race
function Promise_race([iterable = Value.undefined], { thisValue }) {
  // 1. Let C be the this value.
  const C = thisValue;
  // 2. Let promiseCapability be ? NewPromiseCapability(C).
  const promiseCapability = Q(NewPromiseCapability(C));
  // 3. Let promiseResolve be GetPromiseResolve(C).
  const promiseResolve = GetPromiseResolve(C);
  // 4. IfAbruptRejectPromise(promiseResolve, promiseCapability).
  IfAbruptRejectPromise(promiseResolve, promiseCapability);
  // 5. Let iteratorRecord be GetIterator(iterable).
  const iteratorRecord = GetIterator(iterable);
  // 6. IfAbruptRejectPromise(iteratorRecord, promiseCapability).
  IfAbruptRejectPromise(iteratorRecord, promiseCapability);
  // 7. Let result be PerformPromiseRace(iteratorRecord, C, promiseCapability, promiseResolve).
  let result = EnsureCompletion(PerformPromiseRace(iteratorRecord, C, promiseCapability, promiseResolve));
  // 8. If result is an abrupt completion, then
  if (result instanceof AbruptCompletion) {
    // a. If iteratorRecord.[[Done]] is false, set result to IteratorClose(iteratorRecord, result).
    if (iteratorRecord.Done === Value.false) {
      result = IteratorClose(iteratorRecord, result);
    }
    // b. IfAbruptRejectPromise(result, promiseCapability).
    IfAbruptRejectPromise(result, promiseCapability);
  }
  // 9. Return Completion(result).
  return Completion(result);
}

// #sec-promise.reject
function Promise_reject([r = Value.undefined], { thisValue }) {
  // 1. Let C be this value.
  const C = thisValue;
  // 2. Let promiseCapability be ? NewPromiseCapability(C).
  const promiseCapability = Q(NewPromiseCapability(C));
  // 3. Perform ? Call(promiseCapability.[[Reject]], undefined, « r »).
  Q(Call(promiseCapability.Reject, Value.undefined, [r]));
  // 4. Return promiseCapability.[[Promise]].
  return promiseCapability.Promise;
}

// #sec-promise.resolve
function Promise_resolve([x = Value.undefined], { thisValue }) {
  // 1. Let C be the this value.
  const C = thisValue;
  // 2. If Type(C) is not Object, throw a TypeError exception.
  if (Type(C) !== 'Object') {
    return surroundingAgent.Throw('TypeError', 'InvalidReceiver', 'Promise.resolve', C);
  }
  // 3. Return ? PromiseResolve(C, x).
  return Q(PromiseResolve(C, x));
}

// #sec-get-promise-@@species
function Promise_symbolSpecies(args, { thisValue }) {
  // 1. Return the this value.
  return thisValue;
}

export function bootstrapPromise(realmRec) {
  const promiseConstructor = bootstrapConstructor(realmRec, PromiseConstructor, 'Promise', 1, realmRec.Intrinsics['%Promise.prototype%'], [
    ['all', Promise_all, 1],
    ['allSettled', Promise_allSettled, 1],
    ['any', Promise_any, 1],
    ['race', Promise_race, 1],
    ['reject', Promise_reject, 1],
    ['resolve', Promise_resolve, 1],
    [wellKnownSymbols.species, [Promise_symbolSpecies]],
  ]);

  promiseConstructor.DefineOwnProperty(new Value('prototype'), Descriptor({
    Writable: Value.false,
    Enumerable: Value.false,
    Configurable: Value.false,
  }));

  realmRec.Intrinsics['%Promise%'] = promiseConstructor;
}
