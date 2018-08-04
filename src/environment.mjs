/* @flow */

/* ::
import type {
  Realm,
} from './engine.mjs';

import type {
  Value,
  ObjectValue,
} from './value.mjs';
*/

import {
  Type,
} from './value.mjs';
import {
  surroundingAgent,
} from './engine.mjs';
import {
  Get,
  HasOwnProperty,
  HasProperty,
  ToBoolean,
} from './abstract-ops/all.mjs';

export class LexicalEnvironment {
  /* ::
  EnvironmentRecord: ?EnvironmentRecord
  */
  constructor() {
    this.EnvironmentRecord = undefined;
  }
}

export class EnvironmentRecord {}

/* ::
declare type Binding = {
  initialized: boolean,
  mutable: boolean,
  strict: ?boolean,
  deletable: boolean,
  value: ?Value,
};
*/

// https://tc39.github.io/ecma262/#sec-lexical-environments
export class DeclarativeEnvironmentRecord extends EnvironmentRecord {
  /* ::
  bindings: Map<Value, Binding>
  */
  constructor() {
    super();
    this.bindings = new Map();
  }

  HasBinding(N /* : Value */) {
    if (this.bindings.has(N)) {
      return true;
    }
    return false;
  }

  CreateMutableBinding(N, D) {
    this.bindings.set(N, {
      initialized: false,
      mutable: true,
      strict: undefined,
      deletable: D,
      value: undefined,
    });
  }

  CreateImmutableBinding(N, S) {
    this.bindings.set(N, {
      initialized: false,
      mutable: false,
      strict: S,
      deletable: false,
      value: undefined,
    });
  }

  InitializeBinding(N, V) {
    const binding = this.bindings.get(N);
    binding.value = V;
    binding.initialized = true;
  }

  SetMutableBinding(N, V, S) {
    const envRec = this;
    if (!this.bindings.has(N)) {
      if (S === true) {
        surroundingAgent.Throw('ReferenceError');
        envRec.CreateMutableBinding(N, true);
        envRec.InitializeBinding(N, V);
        return;
      }
    }

    const binding = this.bindings.get(N);

    if (binding.strict === true) {
      S = true;
    }

    if (binding.initialized === false) {
      surroundingAgent.Throw('ReferenceError');
    } else if (binding.mutable === true) {
      binding.value = V;
    } else if (S === true) {
      surroundingAgent.Throw('ReferenceError');
    }
  }

  GetBindingValue(N, S) {
    const binding = this.bindings.get(N);
    if (binding.initialized === false) {
      surroundingAgent.Throw('ReferenceError');
    }
    return binding.value;
  }

  DeleteBinding(N) {
    const binding = this.bindings.get(N);
    if (binding.deletable === false) {
      return false;
    }

    this.bindings.delete(N);

    return true;
  }

  HasThisBinding() {
    return false;
  }

  HasSuperBinding() {
    return false;
  }

  WithBaseObject() {
    return undefined;
  }
}

export class ObjectEnvironmentRecord extends EnvironmentRecord {
  constructor(BindingObject) {
    super();
    this.bindingObject = BindingObject;
    this.withEnvironment = false;
  }

  HasBinding(N) {
    const envRec = this;
    const bindings = envRec.bindingObject;

    const foundBinding = HasProperty(bindings, N);
    if (foundBinding === false) {
      return false;
    }

    if (this.withEnvironment === false) {
      return false;
    }

    const unscopables = Get(bindings, surroundingAgent.intrinsic('@@unscopables'));
    if (Type(unscopables) === 'Object') {
      const blocked = ToBoolean(Get(unscopables, N));
      if (blocked === true) {
        return false;
      }
    }

    return true;
  }
}

export class GlobalEnvironmentRecord extends EnvironmentRecord {
  /* ::
  ObjectRecord: ObjectEnvironmentRecord
  GlobalThisValue: ObjectValue
  DeclarativeRecord: DeclarativeEnvironmentRecord
  VarNames: string[]
  */
  constructor() {
    super();
    // $FlowFixMe
    this.ObjectRecord = undefined;
    // $FlowFixMe
    this.GlobalThisValue = undefined;
    // $FlowFixMe
    this.DeclarativeRecord = undefined;
    this.VarNames = [];
  }

  HasBinding(N /* : Value */) {
    const envRec = this;
    const DclRec = envRec.DeclarativeRecord;
    if (DclRec.HasBinding(N)) {
      return true;
    }
    const ObjRec = envRec.ObjectRecord;
    return ObjRec.HasBinding(N);
  }

  CreateMutableBinding(N /* : Value */, D) {
    const envRec = this;
    const DclRec = envRec.DeclarativeRecord;
    if (DclRec.HasBinding(N)) {
      surroundingAgent.Throw('TypeError');
    }
    return DclRec.CreateMutableBinding(N, D);
  }

  CreateImmutableBinding(N /* : Value */, S) {
    const envRec = this;
    const DclRec = envRec.DeclarativeRecord;
    if (DclRec.HasBinding(N)) {
      surroundingAgent.Throw('TypeError');
    }
    return DclRec.CreateImmutableBinding(N, S);
  }

  InitializeBinding(N, V) {
    const envRec = this;
    const DclRec = envRec.DeclarativeRecord;
    if (DclRec.HasBinding(N)) {
      return DclRec.InitializeBinding(N, V);
    }
    const ObjRec = envRec.ObjectRecord;
    return ObjRec.InitializeBinding(N, V);
  }

  SetMutableBinding(N, V, S) {
    const envRec = this;
    const DclRec = envRec.DeclarativeRecord;
    if (DclRec.HasBinding(N)) {
      return DclRec.SetMutableBinding(N, V, S);
    }
    const ObjRec = envRec.ObjectRecord;
    return ObjRec.SetMutableBinding(N, V, S);
  }

  GetBindingValue(N, S) {
    const envRec = this;
    const DclRec = envRec.DeclarativeRecord;
    if (DclRec.HasBinding(N)) {
      return DclRec.GetBindingValue(N, S);
    }
    const ObjRec = envRec.ObjectRecord;
    return ObjRec.GetBindingValue(N, S);
  }

  DeleteBinding(N /* : Value */) {
    const envRec = this;
    const DclRec = this.DeclarativeRecord;
    if (DclRec.HasBinding(N)) {
      return DclRec.DeleteBinding(N);
    }
    const ObjRec = envRec.ObjectRecord;
    const globalObject = ObjRec.bindingObject;
    const existingProp = HasOwnProperty(globalObject, N);
    if (existingProp === true) {
      const status = ObjRec.DeleteBinding(N);
      if (status === true) {
        const varNames = envRec.VarNames;
        // If N is an element of varNames, remove that element from the varNames.
      }
      return status;
    }
    return true;
  }

  HasThisBinding() {}

  HasSuperBinding() {}

  WithBaseObject() {}

  HasVarDeclaration() {}

  HasLexicalDeclaration() {}

  HasRestrictedGlobalProperty() {}

  CanDeclareGlobalVar() {}

  CanDeclareGlobalFunction() {}

  CreateGlobalVarBinding() {}

  CreateGlobalFunctionBinding() {}
}
