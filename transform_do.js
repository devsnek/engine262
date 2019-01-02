'use strict';

const { relative, resolve } = require('path');

const COMPLETION_PATH = resolve('./src/completion.mjs');
const ABSTRACT_OPS_PATH = resolve('./src/abstract-ops/all.mjs');

function fileToImport(file, refPath) {
  return relative(file.opts.filename, refPath)
    .replace(/\\/g, '/') // Support building on Windows
    .replace('../', './');
}

module.exports = ({ types: t, template }) => ({
  visitor: {
    Program: {
      enter(path, state) {
        if (state.file.opts.filename === COMPLETION_PATH) {
          return;
        }
        state.foundCompletion = false;
        state.needCompletion = false;
        state.foundCall = false;
        state.needCall = false;
      },
      exit(path, state) {
        if (!state.foundCompletion && state.needCompletion && !state.file.opts.filename.endsWith('completion.mjs')) {
          const r = fileToImport(state.file, COMPLETION_PATH);
          path.node.body.unshift(template.ast(`import { Completion, AbruptCompletion } from '${r}';`));
        }
        if (!state.foundCall && state.needCall) {
          const r = fileToImport(state.file, ABSTRACT_OPS_PATH);
          path.node.body.unshift(template.ast(`import { Call } from '${r}';`));
        }
      },
    },
    ImportDeclaration(path, state) {
      if (path.node.source.value.endsWith('completion.mjs')) {
        state.foundCompletion = true;
        if (!path.node.specifiers.find((s) => s.local.name === 'Completion')) {
          path.node.specifiers.push(
            t.ImportSpecifier(t.Identifier('Completion'), t.Identifier('Completion')),
          );
        }
        if (!path.node.specifiers.find((s) => s.local.name === 'AbruptCompletion')) {
          path.node.specifiers.push(
            t.ImportSpecifier(t.Identifier('AbruptCompletion'), t.Identifier('AbruptCompletion')),
          );
        }
      } else if (path.node.source.value.endsWith('abstract-ops/all.mjs')
          || (state.file.opts.filename.includes('abstract-ops') && path.node.source.value === './all.mjs')) {
        if (state.file.opts.filename.endsWith('api.mjs')) {
          return;
        }
        state.foundCall = true;
        if (!state.file.opts.filename.endsWith('object-operations.mjs')
            && !path.node.specifiers.find((s) => s.local.name === 'Call')) {
          path.node.specifiers.push(
            t.ImportSpecifier(t.Identifier('Call'), t.Identifier('Call')),
          );
        }
      }
    },
    CallExpression(path, state) {
      if (!t.isIdentifier(path.node.callee)) {
        return;
      }
      if (path.node.callee.name === 'Q' || path.node.callee.name === 'ReturnIfAbrupt') {
        const [argument] = path.node.arguments;

        if (t.isReturnStatement(path.parentPath)) {
          path.replaceWith(argument);
          return;
        }

        state.needCompletion = true;

        if (t.isIdentifier(argument)) {
          const binding = path.scope.getBinding(argument.name);
          binding.path.parent.kind = 'let';
          path.replaceWith(template(`
          (do {
            if (ARGUMENT instanceof AbruptCompletion) {
              return ARGUMENT;
            } else if (ARGUMENT instanceof Completion) {
              ARGUMENT = ARGUMENT.Value;
            } else {
              ARGUMENT;
            }
          });
          `, { plugins: ['doExpressions'] })({ ARGUMENT: argument }));
        } else {
          const hygenicTemp = path.scope.generateUidIdentifier('hygenicTemp');
          path.replaceWith(template(`
          (do {
            const HYGENIC_TEMP = ARGUMENT;
            if (HYGENIC_TEMP instanceof AbruptCompletion) {
              return HYGENIC_TEMP;
            } else if (HYGENIC_TEMP instanceof Completion) {
              HYGENIC_TEMP.Value;
            } else {
              HYGENIC_TEMP;
            }
          });
          `, { plugins: ['doExpressions'] })({ HYGENIC_TEMP: hygenicTemp, ARGUMENT: argument }));
        }
      } else if (path.node.callee.name === 'X') {
        state.needCompletion = true;
        state.needCall = true;
        if (path.scope.getBinding('Call') !== undefined) {
          state.foundCall = true;
        }

        const [argument] = path.node.arguments;
        const val = path.scope.generateUidIdentifier('val');

        path.replaceWith(template(`
        (do {
          const VAL = ARGUMENT;
          if (VAL instanceof AbruptCompletion) {
            throw new TypeError('!(VAL instanceof AbruptCompletion)');
          }
          if (VAL instanceof Completion) {
            VAL.Value;
          } else {
            VAL;
          }
        });
        `, { plugins: ['doExpressions'] })({ VAL: val, ARGUMENT: argument }));
      } else if (path.node.callee.name === 'IfAbruptRejectPromise') {
        state.needCompletion = true;
        state.needCall = true;
        if (path.scope.getBinding('Call') !== undefined) {
          state.foundCall = true;
        }

        const [value, capability] = path.node.arguments;

        if (!t.isIdentifier(value)) {
          throw path.get('arguments.0').buildCodeFrameError('First argument to IfAbruptRejectPromise should be an identifier');
        }
        if (!t.isIdentifier(capability)) {
          throw path.get('arguments.1').buildCodeFrameError('Second argument to IfAbruptRejectPromise should be an identifier');
        }

        const binding = path.scope.getBinding(value.name);
        binding.path.parent.kind = 'let';

        const hygenicTemp = path.scope.generateUidIdentifier('hygenicTemp');

        path.replaceWith(template(`
        (do {
          if (VALUE instanceof AbruptCompletion) {
            const HYGENIC_TEMP = Call(CAPABILITY.Reject, Value.undefined, [VALUE.Value]);
            if (HYGENIC_TEMP instanceof AbruptCompletion) {
              return HYGENIC_TEMP;
            }
            return CAPABILITY.Promise;
          } else if (VALUE instanceof Completion) {
            VALUE = VALUE.Value;
          }
        });
        `, { plugins: ['doExpressions'] })({ VALUE: value, CAPABILITY: capability, HYGENIC_TEMP: hygenicTemp }));
      } else if (path.node.callee.name === 'Assert') {
        const [assertion, message] = path.get('arguments');
        if (!message) {
          path.node.arguments.push(t.stringLiteral(assertion.getSource()));
        }
      }
    },
  },
});
