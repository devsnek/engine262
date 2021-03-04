import { surroundingAgent } from '../engine.mjs';
import {
  SameValue,
  RequireInternalSlot,
  HasIdentity,
} from '../abstract-ops/all.mjs';
import { Value } from '../value.mjs';
import { Q } from '../completion.mjs';
import { bootstrapPrototype } from './bootstrap.mjs';

// #sec-weakmap.prototype.delete
function WeakMapProto_delete([key = Value.undefined], { thisValue }) {
  // 1. Let M be the this value.
  const M = thisValue;
  // 2. Perform ? RequireInternalSlot(M, [[WeakMapData]]).
  Q(RequireInternalSlot(M, 'WeakMapData'));
  // 3. Let entries be the List that is M.[[WeakMapData]].
  const entries = M.WeakMapData;
  // 4. If Type(key) is not Object, return false.
  // (*SymbolsAsWeakMapKeys) 4. If HasIdentity(key) is false, return false.
  if (HasIdentity(key) === Value.false) {
    return Value.false;
  }
  // 5. For each Record { [[Key]], [[Value]] } p that is an element of entries, do
  for (let i = 0; i < entries.length; i += 1) {
    const p = entries[i];
    // a. If p.[[Key]] is not empty and SameValue(p.[[Key]], key) is true, then
    if (p.Key !== undefined && SameValue(p.Key, key) === Value.true) {
      // i. Set p.[[Key]] to empty.
      p.Key = undefined;
      // ii. Set p.[[Value]] to empty.
      p.Value = undefined;
      // iii. return true.
      return Value.true;
    }
  }
  // 6. Return false.
  return Value.false;
}

// #sec-weakmap.prototype.get
function WeakMapProto_get([key = Value.undefined], { thisValue }) {
  // 1. Let m be the this value.
  const M = thisValue;
  // 2. Perform ? RequireInternalSlot(M, [[WeakMapData]]).
  Q(RequireInternalSlot(M, 'WeakMapData'));
  // 3. Let entries be the List that is M.[[WeakMapData]].
  const entries = M.WeakMapData;
  // 4. If Type(key) is not Object, return undefined.
  // (*SymbolsAsWeakMapKeys) 4. If HasIdentity(key) is false, return undefined.
  if (HasIdentity(key) === Value.false) {
    return Value.undefined;
  }
  // 5. For each Record { [[Key]], [[Value]] } p that is an element of entries, do
  for (const p of entries) {
    // a. If p.[[Key]] is not empty and SameValue(p.[[Key]], key) is true, return p.[[Value]].
    if (p.Key !== undefined && SameValue(p.Key, key) === Value.true) {
      return p.Value;
    }
  }
  // 6. Return undefined.
  return Value.undefined;
}

// #sec-weakmap.prototype.has
function WeakMapProto_has([key = Value.undefined], { thisValue }) {
  // 1. Let M be the this value.
  const M = thisValue;
  // 2. Perform ? RequireInternalSlot(M, [[WeakMapData]]).
  Q(RequireInternalSlot(M, 'WeakMapData'));
  // 3. Let entries be the List that is M.[[WeakMapData]].
  const entries = M.WeakMapData;
  // 4. If Type(key) is not Object, return false.
  // (*SymbolsAsWeakMapKeys) 4. If HasIdentity(key) is false, return false.
  if (HasIdentity(key) === Value.false) {
    return Value.false;
  }
  // 5. For each Record { [[Key]], [[Value]] } p that is an element of entries, do
  for (const p of entries) {
    // a. If p.[[Key]] is not empty and SameValue(p.[[Key]], key) is true, return true.
    if (p.Key !== undefined && SameValue(p.Key, key) === Value.true) {
      return Value.true;
    }
  }
  // 6. Return false.
  return Value.false;
}

// #sec-weakmap.prototype.set
function WeakMapProto_set([key = Value.undefined, value = Value.undefined], { thisValue }) {
  // 1. Let M be the this value.
  const M = thisValue;
  // 2. Perform ? RequireInternalSlot(M, [[WeakMapData]]).
  Q(RequireInternalSlot(M, 'WeakMapData'));
  // 3. Let entries be the List that is M.[[WeakMapData]].
  const entries = M.WeakMapData;
  // 4. If Type(key) is not Object, throw a TypeError exception.
  // (*SymbolsAsWeakMapKeys) 4. If HasIdentity(key) is false, throw a TypeError exception.
  if (HasIdentity(key) === Value.false) {
    return surroundingAgent.Throw('TypeError', 'WeakCollectionNotObject', key);
  }
  // 5. For each Record { [[Key]], [[Value]] } p that is an element of entries, do
  for (const p of entries) {
    // a. If p.[[Key]] is not empty and SameValue(p.[[Key]], key) is true, then
    if (p.Key !== undefined && SameValue(p.Key, key) === Value.true) {
      // i. Set p.[[Value]] to value.
      p.Value = value;
      // ii. Return M.
      return M;
    }
  }
  // 6. Let p be the Record { [[Key]]: key, [[Value]]: value }.
  const p = { Key: key, Value: value };
  // 7. Append p as the last element of entries.
  entries.push(p);
  // 8. Return M.
  return M;
}

export function bootstrapWeakMapPrototype(realmRec) {
  const proto = bootstrapPrototype(realmRec, [
    ['delete', WeakMapProto_delete, 1],
    ['get', WeakMapProto_get, 1],
    ['has', WeakMapProto_has, 1],
    ['set', WeakMapProto_set, 2],
  ], realmRec.Intrinsics['%Object.prototype%'], 'WeakMap');

  realmRec.Intrinsics['%WeakMap.prototype%'] = proto;
}
