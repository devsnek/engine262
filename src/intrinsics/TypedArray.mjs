import { Q, X } from '../completion.mjs';
import { surroundingAgent } from '../engine.mjs';
import { msg } from '../helpers.mjs';
import {
  Descriptor,
  Value,
  wellKnownSymbols,
} from '../value.mjs';
import {
  Assert,
  Call,
  CreateBuiltinFunction,
  Get,
  GetMethod,
  IsCallable,
  IsConstructor,
  IterableToList,
  Set,
  SetFunctionLength,
  SetFunctionName,
  ToLength,
  ToObject,
  ToString,
  TypedArrayCreate,
} from '../abstract-ops/all.mjs';
import { BootstrapConstructor } from './Bootstrap.mjs';

// 22.2.1 #sec-%typedarray%-intrinsic-object
function TypedArrayConstructor() {
  // NewTarget
  // This is to make sure this constructor has a [[Construct]] internal method.
  return surroundingAgent.Throw('TypeError', '%TypedArray% is not directly constructable');
}

// 22.2.2.1 #sec-%typedarray%.from
function TypedArray_from([source, mapfn, thisArg], { thisValue }) {
  const C = thisValue;
  if (IsConstructor(C) === Value.false) {
    return surroundingAgent.Throw('TypeError', msg('NotAConstructor', C));
  }
  let mapping;
  if (mapfn !== undefined && mapfn !== Value.undefined) {
    if (IsCallable(mapfn) === Value.false) {
      return surroundingAgent.Throw('TypeError', msg('NotAFunction', mapfn));
    }
    mapping = true;
  } else {
    mapping = false;
  }
  const T = thisArg !== undefined ? thisArg : Value.undefined;
  const usingIterator = Q(GetMethod(source, wellKnownSymbols.iterator));
  if (usingIterator !== Value.undefined) {
    const values = Q(IterableToList(source, usingIterator));
    const len = values.length;
    const targetObj = Q(TypedArrayCreate(C, [new Value(len)]));
    let k = 0;
    while (k < len) {
      const Pk = X(ToString(new Value(k)));
      const kValue = values.shift();
      let mappedValue;
      if (mapping) {
        mappedValue = Q(Call(mapfn, T, [kValue, new Value(k)]));
      } else {
        mappedValue = kValue;
      }
      Q(Set(targetObj, Pk, mappedValue, Value.true));
      k += 1;
    }
    Assert(values.length === 0);
    return targetObj;
  }

  // NOTE: source is not an Iterable so assume it is already an array-like
  // object.
  const arrayLike = X(ToObject(source));
  const arrayLikeLength = Q(Get(arrayLike, new Value('length')));
  const len = Q(ToLength(arrayLikeLength)).numberValue();
  const targetObj = Q(TypedArrayCreate(C, [new Value(len)]));
  let k = 0;
  while (k < len) {
    const Pk = X(ToString(new Value(k)));
    const kValue = Q(Get(arrayLike, Pk));
    let mappedValue;
    if (mapping) {
      mappedValue = Q(Call(mapfn, T, [kValue, new Value(k)]));
    } else {
      mappedValue = kValue;
    }
    Q(Set(targetObj, Pk, mappedValue, Value.true));
    k += 1;
  }
  return targetObj;
}

// 22.2.2.2 #sec-%typedarray%.of
function TypedArray_of(items, { thisValue }) {
  const len = items.length;
  const C = thisValue;
  if (IsConstructor(C) === Value.false) {
    return surroundingAgent.Throw('TypeError', msg('NotAConstructor', C));
  }
  const newObj = Q(TypedArrayCreate(C, [new Value(len)]));
  let k = 0;
  while (k < len) {
    const kValue = items[k];
    const Pk = X(ToString(new Value(k)));
    Q(Set(newObj, Pk, kValue, Value.true));
    k += 1;
  }
  return newObj;
}

// 22.2.2.4 #sec-get-%typedarray%-@@species
function TypedArray_speciesGetter(args, { thisValue }) {
  return thisValue;
}

export function CreateTypedArray(realmRec) {
  const typedArrayConstructor = BootstrapConstructor(realmRec, TypedArrayConstructor, 'TypedArray', 0, realmRec.Intrinsics['%TypedArrayPrototype%'], [
    ['from', TypedArray_from, 1],
    ['of', TypedArray_of, 0],
  ]);

  {
    const speciesMethod = CreateBuiltinFunction(TypedArray_speciesGetter, [], realmRec);
    X(SetFunctionLength(speciesMethod, new Value(0)));
    X(SetFunctionName(speciesMethod, new Value('get [Symbol.species]')));
    X(typedArrayConstructor.DefineOwnProperty(wellKnownSymbols.species, Descriptor({
      Get: speciesMethod,
      Set: Value.undefined,
      Enumerable: Value.false,
      Configurable: Value.true,
    })));
  }

  realmRec.Intrinsics['%TypedArray%'] = typedArrayConstructor;
}
