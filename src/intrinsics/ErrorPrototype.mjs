import {
  surroundingAgent,
} from '../engine.mjs';
import {
  Type,
  Value,
} from '../value.mjs';
import {
  CreateDataPropertyOrThrow,
  Get,
  GetStackString,
  ToString,
} from '../abstract-ops/all.mjs';
import { Q } from '../completion.mjs';
import { bootstrapPrototype } from './bootstrap.mjs';

// #sec-error.prototype.tostring
function ErrorProto_toString(args, { thisValue }) {
  // 1. Let O be this value.
  const O = thisValue;
  // 2. If Type(O) is not Object, throw a TypeError exception.
  if (Type(O) !== 'Object') {
    return surroundingAgent.Throw('TypeError', 'NotAnObject', O);
  }
  // 3. Let name be ? Get(O, "name").
  let name = Q(Get(O, new Value('name')));
  // 4. If name is undefined, set name to "Error"; otherwise set name to ? ToString(name).
  if (name === Value.undefined) {
    name = new Value('Error');
  } else {
    name = Q(ToString(name));
  }
  // 5. Let msg be ? Get(O, "message").
  let msg = Q(Get(O, new Value('message')));
  // 6. If msg is undefined, set msg to the empty String; otherwise set msg to ? ToString(msg).
  if (msg === Value.undefined) {
    msg = new Value('');
  } else {
    msg = Q(ToString(msg));
  }
  // 7. If name is the empty String, return msg.
  if (name.stringValue() === '') {
    return msg;
  }
  // 8. If msg is the empty String, return name.
  if (msg.stringValue() === '') {
    return name;
  }
  // 9. Return the string-concatenation of name, the code unit 0x003A (COLON), the code unit 0x0020 (SPACE), and msg.
  return new Value(`${name.stringValue()}: ${msg.stringValue()}`);
}

// https://tc39.es/proposal-error-stacks/#sec-get-error.prototype.stack
function ErrorProto_getStack(args, { thisValue }) {
  // 1. Let E be the this value.
  const E = thisValue;
  // 2. If Type(E) is not Object, throw a TypeError exception.
  if (Type(E) !== 'Object') {
    return surroundingAgent.Throw('TypeError', 'NotAnObject', E);
  }
  // 3. If E does not have an [[ErrorData]] internal slot, return undefined.
  if (!('ErrorData' in E)) {
    return Value.undefined;
  }
  // 4. Return ? GetStackString(error).
  return Q(GetStackString(E));
}

// https://tc39.es/proposal-error-stacks/#sec-set-error.prototype.stack
function ErrorProto_setStack([value], { thisValue }) {
  // 1. Let E be the this value.
  const E = thisValue;
  // 2. If Type(E) is not Object, throw a TypeError exception.
  if (Type(E) !== 'Object') {
    return surroundingAgent.Throw('TypeError', 'NotAnObject', E);
  }
  // 3. Return ? CreateDataPropertyOrThrow(E, "stack", value);
  return Q(CreateDataPropertyOrThrow(E, new Value('stack'), value));
}

export function bootstrapErrorPrototype(realmRec) {
  const proto = bootstrapPrototype(realmRec, [
    ['toString', ErrorProto_toString, 0],
    ['message', new Value('')],
    ['name', new Value('Error')],
    ['stack', [ErrorProto_getStack, ErrorProto_setStack]],
  ], realmRec.Intrinsics['%Object.prototype%']);

  realmRec.Intrinsics['%Error.prototype%'] = proto;
}
