import { surroundingAgent } from '../engine.mjs';
import {
  Assert,
  Call,
  CreateBuiltinFunction,
  Get,
  Invoke,
  IsCallable,
  IsConstructor,
  IsPromise,
  NewPromiseCapability,
  PerformPromiseThen,
  PromiseResolve,
  SpeciesConstructor,
} from '../abstract-ops/all.mjs';
import { Type, Value } from '../value.mjs';
import { Q, ThrowCompletion, X } from '../completion.mjs';
import { bootstrapPrototype } from './bootstrap.mjs';

// #sec-promise.prototype.catch
function PromiseProto_catch([onRejected = Value.undefined], { thisValue }) {
  // 1. Let promise be the this value.
  const promise = thisValue;
  // 2. Return ? Invoke(promise, "then", « undefined, onRejected »).
  return Q(Invoke(promise, new Value('then'), [Value.undefined, onRejected]));
}

// #sec-thenfinallyfunctions
function ThenFinallyFunctions([value = Value.undefined]) {
  // 1. Let F be the active function object.
  const F = surroundingAgent.activeFunctionObject;
  // 2. Let onFinally be F.[[OnFinally]].
  const onFinally = F.OnFinally;
  // 3. Assert: IsCallable(onFinally) is true.
  Assert(IsCallable(onFinally) === Value.true);
  // 4. Let result be ? Call(onFinally, undefined).
  const result = Q(Call(onFinally, Value.undefined));
  // 5. Let C be F.[[Constructor]].
  const C = F.Constructor;
  // 6. Assert: IsConstructor(C) is true.
  Assert(IsConstructor(C) === Value.true);
  // 7. Let promise be ? PromiseResolve(C, result).
  const promise = Q(PromiseResolve(C, result));
  // 8. Let valueThunk be equivalent to a function that returns value.
  const valueThunk = CreateBuiltinFunction(() => value, 0, new Value(''), []);
  // 9. Return ? Invoke(promise, "then", « valueThunk »).
  return Q(Invoke(promise, new Value('then'), [valueThunk]));
}

// #sec-catchfinallyfunctions
function CatchFinallyFunctions([reason = Value.undefined]) {
  // 1. Let F be the active function object.
  const F = surroundingAgent.activeFunctionObject;
  // 2. Let onFinally be F.[[OnFinally]].
  const onFinally = F.OnFinally;
  // 3. Assert: IsCallable(onFinally) is true.
  Assert(IsCallable(onFinally) === Value.true);
  // 4. Let result be ? Call(onFinally, undefined).
  const result = Q(Call(onFinally, Value.undefined));
  // 5. Let C be F.[[Constructor]].
  const C = F.Constructor;
  // 6. Assert: IsConstructor(C) is true.
  Assert(IsConstructor(C) === Value.true);
  // 7. Let promise be ? PromiseResolve(C, result).
  const promise = Q(PromiseResolve(C, result));
  // 8. Let thrower be equivalent to a function that throws reason.
  const thrower = CreateBuiltinFunction(() => ThrowCompletion(reason), 0, new Value(''), []);
  // 9. Return ? Invoke(promise, "then", « thrower »).
  return Q(Invoke(promise, new Value('then'), [thrower]));
}

// #sec-promise.prototype.finally
function PromiseProto_finally([onFinally = Value.undefined], { thisValue }) {
  // 1. Let promise be the this value.
  const promise = thisValue;
  // 2. If Type(promise) is not Object, throw a TypeError exception.
  if (Type(promise) !== 'Object') {
    return surroundingAgent.Throw('TypeError', 'NotATypeObject', 'Promise', promise);
  }
  // 3. Let C be ? SpeciesConstructor(promise, %Promise%).
  const C = SpeciesConstructor(promise, surroundingAgent.intrinsic('%Promise%'));
  // 4. Assert: IsConstructor(C) is true.
  Assert(IsConstructor(C) === Value.true);
  let thenFinally;
  let catchFinally;
  // 5. If IsCallable(onFinally) is false, then
  if (IsCallable(onFinally) === Value.false) {
    // a. Let thenFinally be onFinally.
    thenFinally = onFinally;
    // b. Let catchFinally be onFinally.
    catchFinally = onFinally;
  } else { // 6. Else,
    // a. Let stepsThenFinally be the algorithm steps defined in Then Finally Functions.
    const stepsThenFinally = ThenFinallyFunctions;
    // b. Let lengthThenFinally be the number of non-optional parameters of the function definition in Then Finally Functions.
    const lengthThenFinally = 1;
    // c. Let thenFinally be ! CreateBuiltinFunction(stepsThenFinally, lengthThenFinally, "", « [[Constructor]], [[OnFinally]] »).
    thenFinally = X(CreateBuiltinFunction(stepsThenFinally, lengthThenFinally, new Value(''), ['Constructor', 'OnFinally']));
    // d. Set thenFinally.[[Constructor]] to C.
    thenFinally.Constructor = C;
    // e. Set thenFinally.[[OnFinally]] to onFinally.
    thenFinally.OnFinally = onFinally;
    // f. Let stepsCatchFinally be the algorithm steps defined in Catch Finally Functions.
    const stepsCatchFinally = CatchFinallyFunctions;
    // g. Let lengthCatchFinally be the number of non-optional parameters of the function definition in Catch Finally Functions.
    const lengthCatchFinally = 1;
    // h. Let catchFinally be ! CreateBuiltinFunction(stepsCatchFinally, « [[Constructor]], [[OnFinally]] »).
    catchFinally = X(CreateBuiltinFunction(stepsCatchFinally, lengthCatchFinally, new Value(''), ['Constructor', 'OnFinally']));
    // i. Set catchFinally.[[Constructor]] to C.
    catchFinally.Constructor = C;
    // j. Set catchFinally.[[OnFinally]] to onFinally.
    catchFinally.OnFinally = onFinally;
  }
  // 7. Return ? Invoke(promise, "then", « thenFinally, catchFinally »).
  return Q(Invoke(promise, new Value('then'), [thenFinally, catchFinally]));
}

// #sec-promise.prototype.then
function PromiseProto_then([onFulfilled = Value.undefined, onRejected = Value.undefined], { thisValue }) {
  // 1. Let promise be the this value.
  const promise = thisValue;
  // 2. If IsPromise(promise) is false, throw a TypeError exception.
  if (IsPromise(promise) === Value.false) {
    return surroundingAgent.Throw('TypeError', 'NotATypeObject', 'Promise', promise);
  }
  // 3. Let C be ? SpeciesConstructor(promise, %Promise%).
  const C = Q(SpeciesConstructor(promise, surroundingAgent.intrinsic('%Promise%')));
  // 4. Let resultCapability be ? NewPromiseCapability(C).
  const resultCapability = Q(NewPromiseCapability(C));
  // 5. Return PerformPromiseThen(promise, onFulfilled, onRejected, resultCapability).
  return PerformPromiseThen(promise, onFulfilled, onRejected, resultCapability);
}

export function bootstrapPromisePrototype(realmRec) {
  const proto = bootstrapPrototype(realmRec, [
    ['catch', PromiseProto_catch, 1],
    ['finally', PromiseProto_finally, 1],
    ['then', PromiseProto_then, 2],
  ], realmRec.Intrinsics['%Object.prototype%'], 'Promise');

  realmRec.Intrinsics['%Promise.prototype.then%'] = X(Get(proto, new Value('then')));

  realmRec.Intrinsics['%Promise.prototype%'] = proto;
}
