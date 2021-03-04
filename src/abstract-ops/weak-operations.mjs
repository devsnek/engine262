import { surroundingAgent } from '../engine.mjs';
import { Type, Value } from '../value.mjs';
import { NormalCompletion, Q, X } from '../completion.mjs';
import { Assert, Call } from './all.mjs';

// https://github.com/tc39/proposal-symbols-as-weakmap-keys
export function HasIdentity(argument) {
  // 1. If Type(argument) is Object, return true.
  if (Type(argument) === 'Object') {
    return Value.true;
  }

  // (*SymbolsAsWeakMapKeys) 2. If Type(argument) is Symbol, return true.
  if (Type(argument) === 'Symbol' && surroundingAgent.feature('symbols-as-weakmap-keys')) {
    return Value.true;
  }

  // 3. Return false.
  return Value.false;
}

// #sec-clear-kept-objects
export function ClearKeptObjects() {
  // 1. Let agentRecord be the surrounding agent's Agent Record.
  const agentRecord = surroundingAgent.AgentRecord;
  // 2. Set agentRecord.[[KeptAlive]] to a new empty List.
  agentRecord.KeptAlive = new Set();
}

// #sec-addtokeptobjects
export function AddToKeptObjects(object) {
  // 1. Let agentRecord be the surrounding agent's Agent Record.
  const agentRecord = surroundingAgent.AgentRecord;
  // 2. Append object to agentRecord.[[KeptAlive]].
  agentRecord.KeptAlive.add(object);
}

// #sec-weakrefderef
export function WeakRefDeref(weakRef) {
  // 1. Let target be weakRef.[[WeakRefTarget]].
  const target = weakRef.WeakRefTarget;
  // 2. If target is not empty, then
  if (target !== undefined) {
    // a. Perform ! AddToKeptObjects(target).
    X(AddToKeptObjects(target));
    // b. Return target.
    return target;
  }
  // 3. Return undefined.
  return Value.undefined;
}

// #sec-cleanup-finalization-registry
export function CleanupFinalizationRegistry(finalizationRegistry, callback) {
  // 1. Assert: finalizationRegistry has [[Cells]] and [[CleanupCallback]] internal slots.
  Assert('Cells' in finalizationRegistry && 'CleanupCallback' in finalizationRegistry);
  // 2. Set callback to finalizationRegistry.[[CleanupCallback]].
  if (callback === undefined || callback === Value.undefined) {
    callback = finalizationRegistry.CleanupCallback;
  }
  // 3. While finalizationRegistry.[[Cells]] contains a Record cell such that cell.[[WeakRefTarget]] is empty, an implementation may perform the following steps:
  for (let i = 0; i < finalizationRegistry.Cells.length; i += 1) {
    // a. Choose any such _cell_.
    const cell = finalizationRegistry.Cells[i];
    if (cell.WeakRefTarget !== undefined) {
      continue;
    }
    // b. Remove cell from finalizationRegistry.[[Cells]].
    finalizationRegistry.Cells.splice(i, 1);
    i -= 1;
    // c. Perform ? Call(callback, undefined, « cell.[[HeldValue]] »).
    Q(Call(callback, Value.undefined, [cell.HeldValue]));
  }
  // 4. Return NormalCompletion(undefined).
  return NormalCompletion(Value.undefined);
}
