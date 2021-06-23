'use strict';

const path = require('path');
const fs = require('fs');
const {
  Value,
  CreateDataProperty,
  DetachArrayBuffer,
  OrdinaryObjectCreate,
  ToString,
  Type,
  Throw,
  AbruptCompletion,
  ManagedRealm,
  inspect,
  gc,
} = require('..');

const createRealm = ({ printCompatMode = false } = {}) => {
  const resolverCache = new Map();
  const trackedPromises = new Set();

  const realm = new ManagedRealm({
    promiseRejectionTracker(promise, operation) {
      switch (operation) {
        case 'reject':
          trackedPromises.add(promise);
          break;
        case 'handle':
          trackedPromises.delete(promise);
          break;
        /* c8 ignore next */
        default:
          throw new RangeError('promiseRejectionTracker', operation);
      }
    },
    resolveImportedModule(referencingScriptOrModule, specifier) {
      try {
        const base = path.dirname(referencingScriptOrModule.HostDefined.specifier);
        const resolved = path.resolve(base, specifier);
        if (resolverCache.has(resolved)) {
          return resolverCache.get(resolved);
        }
        const source = fs.readFileSync(resolved, 'utf8');
        const m = resolved.endsWith('.json')
          ? realm.createJSONModule(resolved, source)
          : realm.createSourceTextModule(resolved, source);
        resolverCache.set(resolved, m);
        return m;
      } catch (e) {
        return Throw(e.name, 'Raw', e.message);
      }
    },
  });

  return realm.scope(() => {
    const $262 = OrdinaryObjectCreate(realm.Intrinsics['%Object.prototype%']);

    let printHandle;
    const setPrintHandle = (f) => {
      printHandle = f;
    };
    CreateDataProperty(realm.GlobalObject, new Value('print'), new Value((args) => {
      /* c8 ignore next */
      if (printHandle !== undefined) {
        printHandle(...args);
      } else {
        if (printCompatMode) {
          for (let i = 0; i < args.length; i += 1) {
            const arg = args[i];
            const s = ToString(arg);
            if (s instanceof AbruptCompletion) {
              return s;
            }
            process.stdout.write(s.stringValue());
            if (i !== args.length - 1) {
              process.stdout.write(' ');
            }
          }
          process.stdout.write('\n');
          return Value.undefined;
        } else {
          const formatted = args.map((a, i) => {
            if (i === 0 && Type(a) === 'String') {
              return a.stringValue();
            }
            return inspect(a, realm);
          }).join(' ');
          console.log(formatted); // eslint-disable-line no-console
        }
      }
      return Value.undefined;
    }, 0, new Value('print')));

    [
      ['global', realm.GlobalObject],
      ['createRealm', () => {
        const info = createRealm();
        return info.$262;
      }],
      ['evalScript', ([sourceText]) => realm.evaluateScript(sourceText.stringValue()), 1],
      ['detachArrayBuffer', ([arrayBuffer]) => DetachArrayBuffer(arrayBuffer), 1],
      ['gc', () => {
        gc();
        return Value.undefined;
      }],
      ['spec', ([v]) => {
        if (v.nativeFunction && v.nativeFunction.section) {
          return new Value(v.nativeFunction.section);
        }
        return Value.undefined;
      }, 1],
    ].forEach(([name, value, length]) => {
      const v = value instanceof Value ? value
        : new Value(value, length, new Value(name));
      CreateDataProperty($262, new Value(name), v);
    });

    CreateDataProperty(realm.GlobalObject, new Value('$262'), $262);
    CreateDataProperty(realm.GlobalObject, new Value('$'), $262);

    return {
      realm,
      $262,
      resolverCache,
      trackedPromises,
      setPrintHandle,
    };
  });
};

module.exports = { createRealm };
