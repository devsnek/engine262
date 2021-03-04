import { surroundingAgent } from '../engine.mjs';
import {
  SameValue,
  RequireInternalSlot,
  HasIdentity,
} from '../abstract-ops/all.mjs';
import { Value } from '../value.mjs';
import { Q } from '../completion.mjs';
import { bootstrapPrototype } from './bootstrap.mjs';

// #sec-weakset.prototype.add
function WeakSetProto_add([value = Value.undefined], { thisValue }) {
  // 1. Let S be this value.
  const S = thisValue;
  // 2. Perform ? RequireInternalSlot(S, [[WeakSetData]]).
  Q(RequireInternalSlot(S, 'WeakSetData'));
  // 3. If Type(value) is not Object, throw a TypeError exception.
  // (*SymbolsAsWeakMapKeys) 3. If HasIdentity(value) is false, throw a TypeError exception.
  if (HasIdentity(value) === Value.false) {
    return surroundingAgent.Throw('TypeError', 'WeakCollectionNotObject', value);
  }
  // 4. Let entries be the List that is S.[[WeakSetData]].
  const entries = S.WeakSetData;
  // 5. For each e that is an element of entries, do
  for (const e of entries) {
    // a. If e is not empty and SameValue(e, value) is true, then
    if (e !== undefined && SameValue(e, value) === Value.true) {
      // i. Return S.
      return S;
    }
  }
  // 6. Append value as the last element of entries.
  entries.push(value);
  // 7. Return S.
  return S;
}

// #sec-weakset.prototype.delete
function WeakSetProto_delete([value = Value.undefined], { thisValue }) {
  // 1. Let S be the this value.`
  const S = thisValue;
  // 2. Perform ? RequireInternalSlot(S, [[WeakSetData]]).
  Q(RequireInternalSlot(S, 'WeakSetData'));
  // 3. If Type(value) is not Object, return false.
  // (*SymbolsAsWeakMapKeys) 3. If HasIdentity(value) is false, return false.
  if (HasIdentity(value) === Value.false) {
    return Value.false;
  }
  // 4. Let entries be the List that is S.[[WeakSetData]].
  const entries = S.WeakSetData;
  // 5. For each e that is an element of entries, do
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    // i. If e is not empty and SameValue(e, value) is true, then
    if (e !== undefined && SameValue(e, value) === Value.true) {
      // i. Replace the element of entries whose value is e with an element whose value is empty.
      entries[i] = undefined;
      // ii. Return true.
      return Value.true;
    }
  }
  // 6. Return false.
  return Value.false;
}

// #sec-weakset.prototype.has
function WeakSetProto_has([value = Value.undefined], { thisValue }) {
  // 1. Let S be the this value.
  const S = thisValue;
  // 2. Perform ? RequireInternalSlot(S, [[WeakSetData]]).
  Q(RequireInternalSlot(S, 'WeakSetData'));
  // 3. Let entries be the List that is S.[[WeakSetData]].
  const entries = S.WeakSetData;
  // 4. If Type(value) is not Object, return false.
  // (*SymbolsAsWeakMapKeys) 4. If HasIdentity(value) is false, return false.
  if (HasIdentity(value) === Value.false) {
    return Value.false;
  }
  // 5. For each e that is an element of entries, do
  for (const e of entries) {
    // a. If e is not empty and SameValue(e, value) is true, return true.
    if (e !== undefined && SameValue(e, value) === Value.true) {
      return Value.true;
    }
  }
  // 6. Return false.
  return Value.false;
}

export function bootstrapWeakSetPrototype(realmRec) {
  const proto = bootstrapPrototype(realmRec, [
    ['add', WeakSetProto_add, 1],
    ['delete', WeakSetProto_delete, 1],
    ['has', WeakSetProto_has, 1],
  ], realmRec.Intrinsics['%Object.prototype%'], 'WeakSet');

  realmRec.Intrinsics['%WeakSet.prototype%'] = proto;
}
