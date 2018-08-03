/* @flow */

/* ::
import type {
  Value,
} from './value.mjs';
*/

export class Completion {
  /* ::
  Type: string
  Value: Value
  Target: ?Object
  */
  constructor(type /* : string */, value /* : Value */, target /* : ?Object */) {
    this.Type = type;
    this.Value = value;
    this.Target = target;
  }
}

export class NormalCompletion extends Completion {
  constructor(value /* : Value */, target /* : ?Object */) {
    super('normal', value, target);
  }
}

export class AbruptCompletion extends Completion {}

export class BreakCompletion extends AbruptCompletion {
  constructor(value /* : Value */, target /* : ?Object */) {
    super('break', value, target);
  }
}

export class ContinueCompletion extends AbruptCompletion {
  constructor(value /* : Value */, target /* : ?Object */) {
    super('continue', value, target);
  }
}

export class ReturnCompletion extends AbruptCompletion {
  constructor(value /* : Value */, target /* : ?Object */) {
    super('return', value, target);
  }
}

export class ThrowCompletion extends AbruptCompletion {
  constructor(value /* : Value */, target /* : ?Object */) {
    super('throw', value, target);
  }
}
