import { surroundingAgent } from '../engine.mjs';
import {
  Assert,
  CreateBuiltinFunction,
  SetIntegrityLevel,
} from '../abstract-ops/all.mjs';
import { Value } from '../value.mjs';
import { X } from '../completion.mjs';

// #sec-%throwtypeerror%
function ThrowTypeError() {
  // 1. Throw a TypeError exception.
  return surroundingAgent.Throw('TypeError', 'StrictPoisonPill');
}

export function bootstrapThrowTypeError(realmRec) {
  const f = X(CreateBuiltinFunction(ThrowTypeError, 0, new Value(''), [], realmRec));
  Assert(X(SetIntegrityLevel(f, 'frozen')) === Value.true);
  realmRec.Intrinsics['%ThrowTypeError%'] = f;
}
