import {
  ArrayExoticObjectValue,
  Value,
  Type,
  Descriptor,
  wellKnownSymbols,
} from '../value.mjs';
import {
  IsConcatSpreadable,
  surroundingAgent,
} from '../engine.mjs';
import {
  ArrayCreate,
  Assert,
  Call,
  Construct,
  CreateArrayIterator,
  CreateBuiltinFunction,
  CreateDataProperty,
  CreateDataPropertyOrThrow,
  DeletePropertyOrThrow,
  Get,
  GetFunctionRealm,
  HasProperty,
  IsArray,
  IsCallable,
  IsConstructor,
  ObjectCreate,
  SameValue,
  SameValueZero,
  Set,
  SetFunctionLength,
  SetFunctionName,
  StrictEqualityComparison,
  ToBoolean,
  ToInteger,
  ToLength,
  ToObject,
  ToString,
} from '../abstract-ops/all.mjs';
import {
  Q, X,
} from '../completion.mjs';

function ArraySpeciesCreate(originalArray, length) {
  Assert(Type(length) === 'Number' && length.numberValue() >= 0);
  const isArray = Q(IsArray(originalArray));
  if (isArray.isFalse()) {
    return Q(ArrayCreate(length));
  }
  let C = Q(Get(originalArray, new Value('constructor')));
  if (IsConstructor(C) === true) {
    const thisRealm = surroundingAgent.currentRealmRecord;
    const realmC = Q(GetFunctionRealm(C));
    if (thisRealm !== realmC) {
      if (SameValue(C, realmC.Intrinsics['%Array%']) === true) {
        C = new Value(undefined);
      }
    }
  }
  if (Type(C) === 'Object') {
    C = Q(Get(C, wellKnownSymbols.species));
    if (Type(C) === 'Null') {
      C = new Value(undefined);
    }
  }
  if (Type(C) === 'Undefined') {
    return Q(ArrayCreate(length));
  }
  if (IsConstructor(C) === false) {
    return surroundingAgent.Throw('TypeError');
  }
  return Q(Construct(C, [length]));
}

function ArrayProto_concat(args, { thisValue }) {
  const O = Q(ToObject(thisValue));
  const A = Q(ArraySpeciesCreate(O, new Value(0)));
  let n = 0;
  const items = [O, ...args];
  while (items.length) {
    const E = items.shift();
    const spreadable = Q(IsConcatSpreadable(E));
    if (spreadable.isTrue()) {
      let k = 0;
      const lenProp = Q(Get(E, new Value('length')));
      const len = Q(ToLength(lenProp));
      if (n + len.numberValue() > (2 ** 53) - 1) {
        return surroundingAgent.Throw('TypeError');
      }
      while (k < len.numberValue()) {
        const P = X(ToString(new Value(k)));
        const exists = Q(HasProperty(E, P));
        if (exists.isTrue()) {
          const subElement = Q(Get(E, P));
          const nStr = X(ToString(new Value(n)));
          Q(CreateDataPropertyOrThrow(A, nStr, subElement));
        }
        n += 1;
        k += 1;
      }
    } else {
      if (n >= (2 ** 53) - 1) {
        return surroundingAgent.Throw('TypeError');
      }
      const nStr = X(ToString(new Value(n)));
      Q(CreateDataPropertyOrThrow(A, nStr, E));
      n += 1;
    }
  }
  Q(Set(A, new Value('length'), new Value(n), new Value(true)));
  return new Value(true);
}

function ArrayProto_copyWithin([target, start, end], { thisValue }) {
  const O = Q(ToObject(thisValue));
  const lenProp = Q(Get(O, new Value('length')));
  const len = Q(ToLength(lenProp));
  const relativeTarget = Q(ToInteger(target));
  let to;
  if (relativeTarget.numberValue() < 0) {
    to = Math.max(len.numberValue() + relativeTarget.numberValue(), 0);
  } else {
    to = Math.min(relativeTarget.numberValue(), len.numberValue());
  }
  const relativeStart = Q(ToInteger(start));
  let from;
  if (relativeStart.numberValue() < 0) {
    from = Math.max(len.numberValue() + relativeStart.numberValue(), 0);
  } else {
    from = Math.min(relativeStart.numberValue(), len.numberValue());
  }
  let relativeEnd;
  if (Type(end) === 'Undefined') {
    relativeEnd = len;
  } else {
    relativeEnd = Q(ToInteger(end));
  }
  let final;
  if (relativeEnd.numberValue() < 0) {
    final = Math.max(len.numberValue() + relativeEnd.numberValue(), 0);
  } else {
    final = Math.min(relativeEnd.numberValue(), len.numberValue());
  }
  let count = Math.min(final - from, len.numberValue() - to);
  let direction;
  if (from < to && to < from + count) {
    direction = -1;
    from += count - 1;
    to += count - 1;
  } else {
    direction = 1;
  }
  while (count > 0) {
    const fromKey = X(ToString(new Value(from)));
    const toKey = X(ToString(new Value(to)));
    const fromPresent = Q(HasProperty(O, fromKey));
    if (fromPresent.isTrue()) {
      const fromVal = Q(Get(O, fromKey));
      Q(Set(O, toKey, fromVal, new Value(true)));
    } else {
      Q(DeletePropertyOrThrow(O, toKey));
    }
    from += direction;
    to += direction;
    count -= 1;
  }
  return O;
}

function ArrayProto_entries(args, { thisValue }) {
  const O = Q(ToObject(thisValue));
  return CreateArrayIterator(O, 'key+value');
}

function ArrayProto_every([callbackFn, thisArg], { thisValue }) {
  const O = Q(ToObject(thisValue));
  const lenProp = Q(Get(O, new Value('length')));
  const len = Q(ToLength(lenProp));
  if (IsCallable(callbackFn).isFalse()) {
    return surroundingAgent.Throw('TypeError');
  }
  let T;
  if (thisArg instanceof Value) {
    T = thisArg;
  } else {
    T = new Value(undefined);
  }
  let k = 0;
  while (k < len.numberValue()) {
    const Pk = X(ToString(new Value(k)));
    const kPresent = Q(HasProperty(O, Pk));
    if (kPresent.isTrue()) {
      const kValue = Q(Get(O, Pk));
      const testResult = ToBoolean(Q(Call(callbackFn, T, [kValue, new Value(k), O])));
      if (testResult.isFalse()) {
        return new Value(false);
      }
    }
    k += 1;
  }
  return new Value(true);
}

function ArrayProto_fill([value, start, end], { thisValue }) {
  const O = Q(ToObject(thisValue));
  const lenProp = Q(Get(O, new Value('length')));
  const len = Q(ToLength(lenProp)).numberValue();
  const relativeStart = Q(ToInteger(start)).numberValue();
  let k;
  if (relativeStart < 0) {
    k = Math.max(len + relativeStart, 0);
  } else {
    k = Math.min(relativeStart, len);
  }
  let relativeEnd;
  if (Type(end) === 'Undefined') {
    relativeEnd = len;
  } else {
    relativeEnd = Q(ToInteger(end)).numberValue();
  }
  let final;
  if (relativeEnd < 0) {
    final = Math.max(len + relativeEnd, 0);
  } else {
    final = Math.min(relativeEnd, len);
  }
  while (k < final) {
    const Pk = X(ToString(k));
    Q(Set(O, Pk, value, new Value(true)));
    k += 1;
  }
  return O;
}

function ArrayProto_filter([callbackfn, thisArg], { thisValue }) {
  const O = Q(ToObject(thisValue));
  const lenProp = Q(Get(O, new Value('length')));
  const len = Q(ToLength(lenProp)).numberValue();
  if (IsCallable(callbackfn).isFalse()) {
    return surroundingAgent.Throw('TypeError', 'callbackfn is not callable');
  }
  const T = thisArg || new Value(undefined);
  const A = Q(ArraySpeciesCreate(O, 0));
  let k = 0;
  let to = 0;
  while (k < len) {
    const Pk = X(ToString(new Value(k)));
    const kPresent = Q(HasProperty(O, Pk));
    if (kPresent.isTrue()) {
      const kValue = Q(Get(O, Pk));
      const selected = ToBoolean(Q(Call(callbackfn, T, [kValue, new Value(k), O])));
      if (selected.isTrue()) {
        Q(CreateDataPropertyOrThrow(A, ToString(new Value(to)), kValue));
        to += 1;
      }
    }
    k += 1;
  }
  return A;
}

function ArrayProto_find([predicate, thisArg], { thisValue }) {
  const O = Q(ToObject(thisValue));
  const lenProp = Q(Get(O, new Value('length')));
  const len = Q(ToLength(lenProp)).numberValue();
  if (IsCallable(predicate).isFalse()) {
    return surroundingAgent.Throw('TypeError', 'predicate is not callable');
  }
  const T = thisArg || new Value(undefined);
  let k = 0;
  while (k < len) {
    const Pk = X(ToString(new Value(k)));
    const kValue = Q(Get(O, Pk));
    const testResult = ToBoolean(Q(Call(predicate, T, [kValue, new Value(k), O])));
    if (testResult.isTrue()) {
      return kValue;
    }
    k += 1;
  }
  return new Value(undefined);
}

function ArrayProto_findIndex([predicate, thisArg], { thisValue }) {
  const O = Q(ToObject(thisValue));
  const lenProp = Q(Get(O, new Value('length')));
  const len = Q(ToLength(lenProp)).numberValue();
  if (IsCallable(predicate).isFalse()) {
    return surroundingAgent.Throw('TypeError', 'predicate is not callable');
  }
  const T = thisArg || new Value(undefined);
  let k = 0;
  while (k < len) {
    const Pk = X(ToString(new Value(k)));
    const kValue = Q(Get(O, Pk));
    const testResult = ToBoolean(Q(Call(predicate, T, [kValue, new Value(k), O])));
    if (testResult.isTrue()) {
      return new Value(k);
    }
    k += 1;
  }
  return new Value(-1);
}

function ArrayProto_forEach([callbackfn, thisArg], { thisValue }) {
  const O = Q(ToObject(thisValue));
  const lenProp = Q(Get(O, new Value('length')));
  const len = Q(ToLength(lenProp)).numberValue();
  if (IsCallable(callbackfn).isFalse()) {
    return surroundingAgent.Throw('TypeError', 'callbackfn is not callable');
  }
  const T = thisArg || new Value(undefined);
  let k = 0;
  while (k < len) {
    const Pk = X(ToString(new Value(k)));
    const kPresent = Q(HasProperty(O, Pk));
    if (kPresent.isTrue()) {
      const kValue = Q(Get(O, Pk));
      Q(Call(callbackfn, T, [kValue, new Value(k), O]));
    }
    k += 1;
  }
  return new Value(undefined);
}

function ArrayProto_includes([searchElement, fromIndex], { thisValue }) {
  const O = Q(ToObject(thisValue));
  const lenProp = Q(Get(O, new Value('length')));
  const len = Q(ToLength(lenProp)).numberValue();
  if (len === 0) {
    return new Value(false);
  }
  const n = fromIndex ? Q(ToInteger(fromIndex)) : 0;
  let k;
  if (n >= 0) {
    k = n;
  } else {
    k = len + n;
    if (k < 0) {
      k = 0;
    }
  }
  while (k < len) {
    const kStr = X(ToString(new Value(k)));
    const elementK = Q(Get(O, kStr));
    if (SameValueZero(searchElement, elementK).isTrue()) {
      return new Value(true);
    }
    k += 1;
  }
  return new Value(false);
}

function ArrayProto_indexOf([searchElement, fromIndex = new Value(0)], { thisValue }) {
  const O = Q(ToObject(thisValue));
  const lenProp = Q(Get(O, new Value('length')));
  const len = Q(ToLength(lenProp)).numberValue();
  if (len === 0) {
    return new Value(-1);
  }
  const n = Q(ToInteger(fromIndex)).numberValue();
  // Assert: If fromIndex is undefined, then n is 0.
  if (n >= len) {
    return new Value(-1);
  }
  let k;
  if (n >= 0) {
    if (Object.is(-0, n)) {
      k = 0;
    } else {
      k = n;
    }
  } else {
    k = len + n;
    if (k < 0) {
      k = 0;
    }
  }
  while (k < len) {
    const kStr = X(ToString(new Value(k)));
    const kPresent = Q(HasProperty(O, kStr));
    if (kPresent.isTrue()) {
      const elementK = Get(O, X(ToString(new Value(k))));
      const same = StrictEqualityComparison(searchElement, elementK);
      if (same.isTrue()) {
        return new Value(k);
      }
    }
    k += 1;
  }
  return new Value(-1);
}

function ArrayProto_join([separator = new Value(undefined)], { thisValue }) {
  const O = Q(ToObject(thisValue));
  const lenProp = Q(Get(O, new Value('length')));
  const len = Q(ToLength(lenProp)).numberValue();
  let sep;
  if (Type(separator) === 'Undefined') {
    sep = ',';
  } else {
    sep = Q(ToString(separator)).stringValue();
  }
  let R = '';
  let k = 0;
  while (k < len) {
    if (k > 0) {
      R = `${R}${sep}`;
    }
    const kStr = X(ToString(new Value(k)));
    const element = Q(Get(O, kStr));
    let next;
    if (Type(element) === 'Undefined' || Type(element) === 'Null') {
      next = '';
    } else {
      next = Q(ToString(element)).stringValue();
    }
    R = `${R}${next}`;
    k += 1;
  }
  return new Value(R);
}

function ArrayProto_keys(args, { thisValue }) {
  const O = Q(ToObject(thisValue));
  return CreateArrayIterator(O, 'key');
}

function ArrayProto_lastIndexOf([searchElement, fromIndex], { thisValue }) {
  const O = Q(ToObject(thisValue));
  const lenProp = Q(Get(O, new Value('length')));
  const len = Q(ToLength(lenProp)).numberValue();
  if (len === 0) {
    return new Value(-1);
  }
  let n;
  if (fromIndex !== undefined) {
    n = Q(ToInteger(fromIndex)).numberValue();
  } else {
    n = len - 1;
  }
  let k;
  if (n >= 0) {
    if (Object.is(n, -0)) {
      k = 0;
    } else {
      k = Math.min(n, len - 1);
    }
  } else {
    k = len + n;
  }
  while (k >= 0) {
    const kStr = X(ToString(new Value(k)));
    const kPresent = Q(HasProperty(O, kStr));
    if (kPresent.isTrue()) {
      const elementK = Q(Get(O, kStr));
      const same = StrictEqualityComparison(searchElement, elementK);
      if (same.isTrue()) {
        return new Value(k);
      }
    }
    k -= 1;
  }
  return new Value(-1);
}

function ArrayProto_map([callbackfn, thisArg], { thisValue }) {
  const O = Q(ToObject(thisValue));
  const lenProp = Q(Get(O, new Value('length')));
  const len = Q(ToLength(lenProp)).numberValue();
  if (IsCallable(callbackfn).isFalse()) {
    return surroundingAgent.Throw('TypeError', 'callbackfn is not callable');
  }
  const T = thisArg || new Value(undefined);
  const A = Q(ArraySpeciesCreate(O, 0));
  let k = 0;
  while (k < len) {
    const Pk = X(ToString(new Value(k)));
    const kPresent = Q(HasProperty(O, Pk));
    if (kPresent.isTrue()) {
      const kValue = Q(Get(O, Pk));
      const mappedValue = Q(Call(callbackfn, T, [kValue, new Value(k), O]));
      Q(CreateDataPropertyOrThrow(A, Pk, mappedValue));
    }
    k += 1;
  }
  return A;
}

function ArrayProto_pop(args, { thisValue }) {
  const O = Q(ToObject(thisValue));
  const len = Q(ToLength(Q(Get(O, new Value('length'))))).numberValue();
  if (len === 0) {
    Q(Set(O, new Value('length'), new Value(0), new Value(true)));
    return new Value(undefined);
  } else {
    const newLen = len - 1;
    const index = Q(ToString(new Value(newLen)));
    const element = Q(Get(O, index));
    Q(DeletePropertyOrThrow(O, index));
    Q(Set(O, new Value('length'), new Value(newLen), new Value(true)));
    return element;
  }
}

function ArrayProto_push([...items], { thisValue }) {
  const O = Q(ToObject(thisValue));
  let len = Q(ToLength(Q(Get(O, new Value('length'))))).numberValue();
  const argCount = items.length;
  if (len + argCount > (2 ** 53) - 1) {
    return surroundingAgent.Throw('TypeError', 'Invalid array length');
  }
  while (items.length > 0) {
    const E = items.shift();
    Q(Set(O, X(ToString(new Value(len))), E, new Value(true)));
    len += 1;
  }
  Q(Set(O, new Value('length'), new Value(len), new Value(true)));
  return new Value(len);
}

function ArrayProto_toString(a, { thisValue }) {
  const array = Q(ToObject(thisValue));
  let func = Q(Get(array, new Value('join')));
  if (IsCallable(func).isFalse()) {
    func = surroundingAgent.intrinsic('%ObjProto_toString%');
  }
  return Q(Call(func, array));
}

function ArrayProto_values(args, { thisValue }) {
  const O = Q(ToObject(thisValue));
  return CreateArrayIterator(O, 'value');
}

export function CreateArrayPrototype(realmRec) {
  const proto = new ArrayExoticObjectValue();
  proto.Prototype = realmRec.Intrinsics['%ObjectPrototype%'];
  proto.Extensible = true;
  proto.properties.set(new Value('length'), Descriptor({
    Value: new Value(0),
    Writable: new Value(true),
    Enumerable: new Value(false),
    Configurable: new Value(false),
  }));

  [
    ['concat', ArrayProto_concat, 1],
    ['copyWithin', ArrayProto_copyWithin, 2],
    ['entries', ArrayProto_entries, 0],
    ['every', ArrayProto_every, 1],
    ['fill', ArrayProto_fill, 1],
    ['filter', ArrayProto_filter, 1],
    ['find', ArrayProto_find, 1],
    ['findIndex', ArrayProto_findIndex, 1],
    ['forEach', ArrayProto_forEach, 1],
    ['includes', ArrayProto_includes, 1],
    ['indexOf', ArrayProto_indexOf, 1],
    ['join', ArrayProto_join, 1],
    ['keys', ArrayProto_keys, 0],
    ['lastIndexOf', ArrayProto_lastIndexOf, 1],
    ['map', ArrayProto_map, 1],
    ['pop', ArrayProto_pop, 0],
    ['push', ArrayProto_push, 1],
    // reduce
    // reduceRight
    // reverse
    // shift
    // slice
    // some
    // sort
    // splice
    // toLocaleString
    ['toString', ArrayProto_toString, 0],
    // unshift
    ['values', ArrayProto_values, 0],
  ].forEach(([name, nativeFunction, length]) => {
    const fn = CreateBuiltinFunction(nativeFunction, [], realmRec);
    SetFunctionName(fn, new Value(name));
    SetFunctionLength(fn, new Value(length));
    proto.DefineOwnProperty(new Value(name), Descriptor({
      Value: fn,
      Writable: new Value(true),
      Enumerable: new Value(false),
      Configurable: new Value(true),
    }));
  });

  proto.DefineOwnProperty(wellKnownSymbols.iterator, proto.GetOwnProperty(new Value('values')));

  {
    const unscopableList = ObjectCreate(new Value(null));
    CreateDataProperty(unscopableList, new Value('copyWithin'), new Value(true));
    CreateDataProperty(unscopableList, new Value('entries'), new Value(true));
    CreateDataProperty(unscopableList, new Value('fill'), new Value(true));
    CreateDataProperty(unscopableList, new Value('find'), new Value(true));
    CreateDataProperty(unscopableList, new Value('findIndex'), new Value(true));
    CreateDataProperty(unscopableList, new Value('includes'), new Value(true));
    CreateDataProperty(unscopableList, new Value('keys'), new Value(true));
    CreateDataProperty(unscopableList, new Value('values'), new Value(true));
    X(proto.DefineOwnProperty(wellKnownSymbols.unscopables, Descriptor({
      Value: unscopableList,
      Writable: new Value(false),
      Enumerable: new Value(false),
      Configurable: new Value(false),
    })));
  }

  realmRec.Intrinsics['%ArrayPrototype%'] = proto;

  realmRec.Intrinsics['%ArrayProto_keys%'] = proto.Get(new Value('keys'), proto);
  realmRec.Intrinsics['%ArrayProto_entries%'] = proto.Get(new Value('entries'), proto);
  realmRec.Intrinsics['%ArrayProto_values%'] = proto.Get(new Value('values'), proto);
}
