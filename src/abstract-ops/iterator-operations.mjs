import { surroundingAgent } from '../engine.mjs';
import {
  Type,
  Value,
  wellKnownSymbols,
} from '../value.mjs';
import {
  Completion,
  EnsureCompletion,
  IfAbruptRejectPromise,
  Q, X,
  Await,
} from '../completion.mjs';
import {
  Assert,
  Call,
  CreateBuiltinFunction,
  CreateDataProperty,
  Get,
  GetMethod,
  GetV,
  PromiseResolve,
  OrdinaryObjectCreate,
  PerformPromiseThen,
  ToBoolean,
} from './all.mjs';

// This file covers abstract operations defined in
// 7.4 #sec-operations-on-iterator-objects
// and
// 25.1 #sec-iteration

// 7.4.1 #sec-getiterator
export function GetIterator(obj, hint, method) {
  if (!hint) {
    hint = 'sync';
  }
  Assert(hint === 'sync' || hint === 'async');
  if (!method) {
    if (hint === 'async') {
      method = Q(GetMethod(obj, wellKnownSymbols.asyncIterator));
      if (method === Value.undefined) {
        const syncMethod = Q(GetMethod(obj, wellKnownSymbols.iterator));
        const syncIteratorRecord = Q(GetIterator(obj, 'sync', syncMethod));
        return Q(CreateAsyncFromSyncIterator(syncIteratorRecord));
      }
    } else {
      method = Q(GetMethod(obj, wellKnownSymbols.iterator));
    }
  }
  const iterator = Q(Call(method, obj));
  if (Type(iterator) !== 'Object') {
    return surroundingAgent.Throw('TypeError', 'NotAnObject', iterator);
  }
  const nextMethod = Q(GetV(iterator, new Value('next')));
  const iteratorRecord = {
    Iterator: iterator,
    NextMethod: nextMethod,
    Done: Value.false,
  };
  return EnsureCompletion(iteratorRecord);
}

// 7.4.2 #sec-iteratornext
export function IteratorNext(iteratorRecord, value) {
  let result;
  if (!value) {
    result = Q(Call(iteratorRecord.NextMethod, iteratorRecord.Iterator));
  } else {
    result = Q(Call(iteratorRecord.NextMethod, iteratorRecord.Iterator, [value]));
  }
  if (Type(result) !== 'Object') {
    return surroundingAgent.Throw('TypeError', 'NotAnObject', result);
  }
  return EnsureCompletion(result);
}

// 7.4.3 #sec-iteratorcomplete
export function IteratorComplete(iterResult) {
  Assert(Type(iterResult) === 'Object');
  return EnsureCompletion(ToBoolean(Q(Get(iterResult, new Value('done')))));
}

// 7.4.4 #sec-iteratorvalue
export function IteratorValue(iterResult) {
  Assert(Type(iterResult) === 'Object');
  return EnsureCompletion(Q(Get(iterResult, new Value('value'))));
}

// 7.4.5 #sec-iteratorstep
export function IteratorStep(iteratorRecord) {
  const result = Q(IteratorNext(iteratorRecord));
  const done = Q(IteratorComplete(result));
  if (done === Value.true) {
    return EnsureCompletion(Value.false);
  }
  return EnsureCompletion(result);
}

// #sec-iteratorclose
export function IteratorClose(iteratorRecord, completion) {
  // 1. Assert: Type(iteratorRecord.[[Iterator]]) is Object.
  Assert(Type(iteratorRecord.Iterator) === 'Object');
  // 2. Assert: completion is a Completion Record.
  // TODO: completion should be a Completion Record so this should not be necessary
  completion = EnsureCompletion(completion);
  Assert(completion instanceof Completion);
  // 3. Let iterator be iteratorRecord.[[Iterator]].
  const iterator = iteratorRecord.Iterator;
  // 4. Let innerResult be GetMethod(iterator, "return").
  let innerResult = EnsureCompletion(GetMethod(iterator, new Value('return')));
  // 5. If innerResult.[[Type]] is normal, then
  if (innerResult.Type === 'normal') {
    // a. Let return be innerResult.[[Value]].
    const ret = innerResult.Value;
    // b. If return is undefined, return Completion(completion).
    if (ret === Value.undefined) {
      return Completion(completion);
    }
    // c. Set innerResult to Call(return, iterator).
    innerResult = Call(ret, iterator);
  }
  // 6. If completion.[[Type]] is throw, return Completion(completion).
  if (completion.Type === 'throw') {
    return Completion(completion);
  }
  // 7. If innerResult.[[Type]] is throw, return Completion(innerResult).
  if (innerResult.Type === 'throw') {
    return Completion(innerResult);
  }
  // 8. If Type(innerResult.[[Value]]) is not Object, throw a TypeError exception.
  if (Type(innerResult.Value) !== 'Object') {
    return surroundingAgent.Throw('TypeError', 'NotAnObject', innerResult.Value);
  }
  // 9. Return Completion(completion).
  return Completion(completion);
}

// #sec-asynciteratorclose
export function* AsyncIteratorClose(iteratorRecord, completion) {
  // 1. Assert: Type(iteratorRecord.[[Iterator]]) is Object.
  Assert(Type(iteratorRecord.Iterator) === 'Object');
  // 2. Assert: completion is a Completion Record.
  Assert(completion instanceof Completion);
  // 3. Let iterator be iteratorRecord.[[Iterator]].
  const iterator = iteratorRecord.Iterator;
  // 4. Let innerResult be GetMethod(iterator, "return").
  let innerResult = EnsureCompletion(GetMethod(iterator, new Value('return')));
  // 5. If innerResult.[[Type]] is normal, then
  if (innerResult.Type === 'normal') {
    // a. Let return be innerResult.[[Value]].
    const ret = innerResult.Value;
    // b. If return is undefined, return Completion(completion).
    if (ret === Value.undefined) {
      return Completion(completion);
    }
    // c. Set innerResult to Call(return, iterator).
    innerResult = Call(ret, iterator);
    // d. If innerResult.[[Type]] is normal, set innerResult to Await(innerResult.[[Value]]).
    if (innerResult.Type === 'normal') {
      innerResult = EnsureCompletion(yield* Await(innerResult.Value));
    }
  }
  // 6. If completion.[[Type]] is throw, return Completion(completion).
  if (completion.Type === 'throw') {
    return Completion(completion);
  }
  // 7. If innerResult.[[Type]] is throw, return Completion(innerResult).
  if (innerResult.Type === 'throw') {
    return Completion(innerResult);
  }
  // 8. If Type(innerResult.[[Value]]) is not Object, throw a TypeError exception.
  if (Type(innerResult.Value) !== 'Object') {
    return surroundingAgent.Throw('TypeError', 'NotAnObject', innerResult.Value);
  }
  // 9. Return Completion(completion).
  return Completion(completion);
}

// 7.4.8 #sec-createiterresultobject
export function CreateIterResultObject(value, done) {
  Assert(Type(done) === 'Boolean');
  const obj = OrdinaryObjectCreate(surroundingAgent.intrinsic('%Object.prototype%'));
  X(CreateDataProperty(obj, new Value('value'), value));
  X(CreateDataProperty(obj, new Value('done'), done));
  return obj;
}

// 7.4.9 #sec-createlistiteratorRecord
export function CreateListIteratorRecord(list) {
  // 1. Let iterator be ! OrdinaryObjectCreate(%IteratorPrototype%, « [[IteratedList]], [[ListNextIndex]] »).
  const iterator = OrdinaryObjectCreate(surroundingAgent.intrinsic('%IteratorPrototype%'), [
    'IteratedList',
    'ListNextIndex',
  ]);
  // 2. Set iterator.[[IteratedList]] to list.
  iterator.IteratedList = list;
  // 3. Set iterator.[[ListNextIndex]] to 0.
  iterator.ListNextIndex = 0;
  // 4. Let steps be the algorithm steps defined in ListIteratorNext Functions.
  const steps = ListIteratorNextSteps;
  // 5. Let length be the number of non-optional parameters of the function definition in ListIteratorNext Functions.
  const length = 0;
  // 6. Let next be ! CreateBuiltinFunction(steps, length, "", « »).
  const next = X(CreateBuiltinFunction(steps, length, new Value(''), []));
  // 7. Return Record { [[Iterator]]: iterator, [[NextMethod]]: next, [[Done]]: *false* }.
  return {
    Iterator: iterator,
    NextMethod: next,
    Done: Value.false,
  };
}

// 7.4.9.1 #sec-listiterator-next
function ListIteratorNextSteps(args, { thisValue }) {
  // 1. Let O be the *this* value.
  const O = thisValue;
  // 2. Assert: Type(O) is Object.
  Assert(Type(O) === 'Object');
  // 3. Assert: O has an [[IteratedList]] internal slot.
  Assert('IteratedList' in O);
  // 4. Let list be O.[[IteratedList]].
  const list = O.IteratedList;
  // 5. Let index be O.[[ListNextIndex]].
  const index = O.ListNextIndex;
  // 6. Let len be the number of elements of list.
  const len = list.length;
  // 7. If index ≥ len, then
  if (index >= len) {
    // a. Return CreateIterResultObject(undefined, true).
    return CreateIterResultObject(Value.undefined, Value.true);
  }
  // 8. Set O.[[ListNextIndex]] to index + 1.
  O.ListNextIndex = index + 1;
  // 9. Return CreateIterResultObject(list[index], false).
  return CreateIterResultObject(list[index], Value.false);
}

// 25.1.4.1 #sec-createasyncfromsynciterator
export function CreateAsyncFromSyncIterator(syncIteratorRecord) {
  const asyncIterator = X(OrdinaryObjectCreate(surroundingAgent.intrinsic('%AsyncFromSyncIteratorPrototype%'), [
    'SyncIteratorRecord',
  ]));
  asyncIterator.SyncIteratorRecord = syncIteratorRecord;
  const nextMethod = X(Get(asyncIterator, new Value('next')));
  return {
    Iterator: asyncIterator,
    NextMethod: nextMethod,
    Done: Value.false,
  };
}

// 25.1.4.2.4 #sec-async-from-sync-iterator-value-unwrap-functions
function AsyncFromSyncIteratorValueUnwrapFunctions([value = Value.undefined]) {
  const F = this;

  return X(CreateIterResultObject(value, F.Done));
}

// 25.1.4.4 #sec-asyncfromsynciteratorcontinuation
export function AsyncFromSyncIteratorContinuation(result, promiseCapability) {
  // 1. Let done be IteratorComplete(result).
  const done = IteratorComplete(result);
  // 2. IfAbruptRejectPromise(done, promiseCapability).
  IfAbruptRejectPromise(done, promiseCapability);
  // 3. Let value be IteratorValue(result).
  const value = IteratorValue(result);
  // 4. IfAbruptRejectPromise(value, promiseCapability).
  IfAbruptRejectPromise(value, promiseCapability);
  // 5. Let valueWrapper be PromiseResolve(%Promise%, value).
  const valueWrapper = PromiseResolve(surroundingAgent.intrinsic('%Promise%'), value);
  // 6. IfAbruptRejectPromise(valueWrapper, promiseCapability).
  IfAbruptRejectPromise(valueWrapper, promiseCapability);
  // 7. Let steps be the algorithm steps defined in Async-from-Sync Iterator Value Unwrap Functions.
  const steps = AsyncFromSyncIteratorValueUnwrapFunctions;
  // 8. Let length be the number of non-optional parameters of the function definition in Async-from-Sync Iterator Value Unwrap Functions.
  const length = 1;
  // 9. Let onFulfilled be ! CreateBuiltinFunction(steps, length, "", « [[Done]] »).
  const onFulfilled = X(CreateBuiltinFunction(steps, length, new Value(''), ['Done']));
  // 10. Set onFulfilled.[[Done]] to done.
  onFulfilled.Done = done;
  // 11. Perform ! PerformPromiseThen(valueWrapper, onFulfilled, undefined, promiseCapability).
  X(PerformPromiseThen(valueWrapper, onFulfilled, Value.undefined, promiseCapability));
  // 12. Return promiseCapability.[[Promise]].
  return promiseCapability.Promise;
}
