import { surroundingAgent } from '../engine.mjs';
import {
  Descriptor,
  Value,
  wellKnownSymbols,
} from '../value.mjs';
import { BoundNames } from '../static-semantics/all.mjs';
import { Q, X } from '../completion.mjs';
import { ValueSet } from '../helpers.mjs';
import {
  Assert,
  CreateBuiltinFunction,
  CreateDataProperty,
  DefinePropertyOrThrow,
  ToString,
  SameValue,
  MakeBasicObject,
  OrdinaryObjectCreate,
  OrdinaryGetOwnProperty,
  OrdinaryDefineOwnProperty,
  OrdinaryGet,
  OrdinarySet,
  OrdinaryDelete,
  Get,
  Set,
  HasOwnProperty,
  IsAccessorDescriptor,
  IsDataDescriptor,
  F,
} from './all.mjs';

// This file covers abstract operations defined in
// 9.4.4 #sec-arguments-exotic-objects


function ArgumentsGetOwnProperty(P) {
  const args = this;
  const desc = OrdinaryGetOwnProperty(args, P);
  if (desc === Value.undefined) {
    return desc;
  }
  const map = args.ParameterMap;
  const isMapped = X(HasOwnProperty(map, P));
  if (isMapped === Value.true) {
    desc.Value = Get(map, P);
  }
  return desc;
}

function ArgumentsDefineOwnProperty(P, Desc) {
  const args = this;
  const map = args.ParameterMap;
  const isMapped = X(HasOwnProperty(map, P));
  let newArgDesc = Desc;
  if (isMapped === Value.true && IsDataDescriptor(Desc) === true) {
    if (Desc.Value === undefined && Desc.Writable !== undefined && Desc.Writable === Value.false) {
      newArgDesc = Descriptor({ ...Desc });
      newArgDesc.Value = X(Get(map, P));
    }
  }
  const allowed = Q(OrdinaryDefineOwnProperty(args, P, newArgDesc));
  if (allowed === Value.false) {
    return Value.false;
  }
  if (isMapped === Value.true) {
    if (IsAccessorDescriptor(Desc) === true) {
      map.Delete(P);
    } else {
      if (Desc.Value !== undefined) {
        const setStatus = Set(map, P, Desc.Value, Value.false);
        Assert(setStatus === Value.true);
      }
      if (Desc.Writable !== undefined && Desc.Writable === Value.false) {
        map.Delete(P);
      }
    }
  }
  return Value.true;
}

function ArgumentsGet(P, Receiver) {
  const args = this;
  const map = args.ParameterMap;
  const isMapped = X(HasOwnProperty(map, P));
  if (isMapped === Value.false) {
    return Q(OrdinaryGet(args, P, Receiver));
  } else {
    return Get(map, P);
  }
}

function ArgumentsSet(P, V, Receiver) {
  const args = this;
  let isMapped;
  let map;
  if (SameValue(args, Receiver) === Value.false) {
    isMapped = false;
  } else {
    map = args.ParameterMap;
    isMapped = X(HasOwnProperty(map, P)) === Value.true;
  }
  if (isMapped) {
    const setStatus = Set(map, P, V, Value.false);
    Assert(setStatus === Value.true);
  }
  return Q(OrdinarySet(args, P, V, Receiver));
}

function ArgumentsDelete(P) {
  const args = this;
  const map = args.ParameterMap;
  const isMapped = X(HasOwnProperty(map, P));
  const result = Q(OrdinaryDelete(args, P));
  if (result === Value.true && isMapped === Value.true) {
    map.Delete(P);
  }
  return result;
}

// 9.4.4.6 #sec-createunmappedargumentsobject
export function CreateUnmappedArgumentsObject(argumentsList) {
  const len = argumentsList.length;
  const obj = OrdinaryObjectCreate(surroundingAgent.intrinsic('%Object.prototype%'), ['ParameterMap']);
  obj.ParameterMap = Value.undefined;
  DefinePropertyOrThrow(obj, new Value('length'), Descriptor({
    Value: F(len),
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.true,
  }));
  let index = 0;
  while (index < len) {
    const val = argumentsList[index];
    X(CreateDataProperty(obj, X(ToString(F(index))), val));
    index += 1;
  }
  X(DefinePropertyOrThrow(obj, wellKnownSymbols.iterator, Descriptor({
    Value: surroundingAgent.intrinsic('%Array.prototype.values%'),
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.true,
  })));
  X(DefinePropertyOrThrow(obj, new Value('callee'), Descriptor({
    Get: surroundingAgent.intrinsic('%ThrowTypeError%'),
    Set: surroundingAgent.intrinsic('%ThrowTypeError%'),
    Enumerable: Value.false,
    Configurable: Value.false,
  })));
  return obj;
}

function ArgGetterSteps() {
  // 1. Let f be the active function object.
  const f = this;
  // 2. Let name be f.[[Name]].
  const name = f.Name;
  // 3. Let env be f.[[Env]].
  const env = f.Env;
  // 4. Return env.GetBindingValue(name, false).
  return env.GetBindingValue(name, Value.false);
}

// 9.4.4.7.1 #sec-makearggetter
function MakeArgGetter(name, env) {
  // 1. Let steps be the steps of an ArgGetter function as specified below.
  const steps = ArgGetterSteps;
  // 2. Let length be the number of non-optional parameters of an ArgGetter function as specified below.
  const length = 0;
  // 3. Let getter be ! CreateBuiltinFunction(steps, length, "", « [[Name]], [[Env]] »).
  const getter = X(CreateBuiltinFunction(steps, length, new Value(''), ['Name', 'Env']));
  // 4. Set getter.[[Name]] to name.
  getter.Name = name;
  // 5. Set getter.[[Env]] to env.
  getter.Env = env;
  // 6. Return getter.
  return getter;
}

function ArgSetterSteps([value]) {
  Assert(value !== undefined);
  // 1. Let f be the active function object.
  const f = this;
  // 2. Let name be f.[[Name]].
  const name = f.Name;
  // 3. Let env be f.[[Env]].
  const env = f.Env;
  // 4. Return env.SetMutableBinding(name, value, false).
  return env.SetMutableBinding(name, value, Value.false);
}

// 9.4.4.7.2 #sec-makeargsetter
function MakeArgSetter(name, env) {
  // 1. Let steps be the steps of an ArgSetter function as specified below.
  const steps = ArgSetterSteps;
  // 2. Let length be the number of non-optional parameters of an ArgSetter function as specified below.
  const length = 1;
  // 3. Let setter be ! CreateBuiltinFunction(steps, length, "", « [[Name]], [[Env]] »).
  const setter = X(CreateBuiltinFunction(steps, length, new Value(''), ['Name', 'Env']));
  // 4. Set setter.[[Name]] to name.
  setter.Name = name;
  // 5. Set setter.[[Env]] to env.
  setter.Env = env;
  // 6. Return setter.
  return setter;
}

// 9.4.4.7 #sec-createmappedargumentsobject
export function CreateMappedArgumentsObject(func, formals, argumentsList, env) {
  // Assert: formals does not contain a rest parameter, any binding
  // patterns, or any initializers. It may contain duplicate identifiers.
  const len = argumentsList.length;
  const obj = X(MakeBasicObject(['Prototype', 'Extensible', 'ParameterMap']));
  obj.GetOwnProperty = ArgumentsGetOwnProperty;
  obj.DefineOwnProperty = ArgumentsDefineOwnProperty;
  obj.Get = ArgumentsGet;
  obj.Set = ArgumentsSet;
  obj.Delete = ArgumentsDelete;
  obj.Prototype = surroundingAgent.intrinsic('%Object.prototype%');
  const map = OrdinaryObjectCreate(Value.null);
  obj.ParameterMap = map;
  const parameterNames = BoundNames(formals);
  const numberOfParameters = parameterNames.length;
  let index = 0;
  while (index < len) {
    const val = argumentsList[index];
    X(CreateDataProperty(obj, X(ToString(F(index))), val));
    index += 1;
  }
  X(DefinePropertyOrThrow(obj, new Value('length'), Descriptor({
    Value: F(len),
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.true,
  })));
  const mappedNames = new ValueSet();
  index = numberOfParameters - 1;
  while (index >= 0) {
    const name = parameterNames[index];
    if (!mappedNames.has(name)) {
      mappedNames.add(name);
      if (index < len) {
        const g = MakeArgGetter(name, env);
        const p = MakeArgSetter(name, env);
        X(map.DefineOwnProperty(X(ToString(F(index))), Descriptor({
          Set: p,
          Get: g,
          Enumerable: Value.false,
          Configurable: Value.true,
        })));
      }
    }
    index -= 1;
  }
  X(DefinePropertyOrThrow(obj, wellKnownSymbols.iterator, Descriptor({
    Value: surroundingAgent.intrinsic('%Array.prototype.values%'),
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.true,
  })));
  X(DefinePropertyOrThrow(obj, new Value('callee'), Descriptor({
    Value: func,
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.true,
  })));
  return obj;
}
