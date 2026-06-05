/**
 * require-read-only-gate
 *
 * Forbids `<Chip onDelete={...}>` and `<Autocomplete onChange={...}>` without
 * static evidence that the author considered read-only mode. Accepted evidence:
 *   - a sibling `disabled` prop on the same JSX element
 *   - the handler is a conditional (ternary) expression
 *   - the handler is a call to `gate(...)` or `<x>.gate(...)` (useReadOnly().gate)
 *   - the handler is the literal `undefined`
 *
 * Regression-prevention rule introduced alongside the read-only audit (#451).
 * Existing call-sites that don't fit the pattern can opt out with a scoped
 * `// eslint-disable-next-line forja/require-read-only-gate` and a comment
 * explaining why (e.g., dialog only renders for writable users).
 */

const GATED_COMPONENTS = {
  Chip: 'onDelete',
  Autocomplete: 'onChange',
};

const PERMISSION_IDENTIFIERS = new Set([
  'canWrite',
  'isAdmin',
  'isOwner',
  'isMaster',
  'readOnly',
]);

function containsPermissionIdentifier(node) {
  if (!node) return false;
  if (node.type === 'Identifier' && PERMISSION_IDENTIFIERS.has(node.name)) return true;
  if (node.type === 'UnaryExpression') return containsPermissionIdentifier(node.argument);
  if (node.type === 'LogicalExpression') {
    return containsPermissionIdentifier(node.left) || containsPermissionIdentifier(node.right);
  }
  return false;
}

function isInsidePermissionAncestor(node) {
  let current = node.parent;
  while (current) {
    if (current.type === 'LogicalExpression' && current.operator === '&&') {
      if (containsPermissionIdentifier(current.left)) return true;
    }
    if (
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression' ||
      current.type === 'ArrowFunctionExpression'
    ) {
      return false;
    }
    current = current.parent;
  }
  return false;
}

function isGatingHandler(expression) {
  if (!expression) return false;
  if (expression.type === 'Identifier' && expression.name === 'undefined') return true;
  if (expression.type === 'ConditionalExpression') return true;
  if (expression.type === 'CallExpression') {
    const callee = expression.callee;
    if (callee.type === 'Identifier' && callee.name === 'gate') return true;
    if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier' && callee.property.name === 'gate') {
      return true;
    }
  }
  return false;
}

function hasDisabledProp(openingElement) {
  return openingElement.attributes.some(
    (attr) => attr.type === 'JSXAttribute' && attr.name && attr.name.name === 'disabled',
  );
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require explicit read-only gating on Chip onDelete and Autocomplete onChange affordances.',
    },
    schema: [],
    messages: {
      requireGate:
        "Write affordance on <{{component}}> requires explicit read-only gating. Add a `disabled` prop, gate the handler with a ternary, or pass it through `useReadOnly().gate(...)`. See issue #451.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        const componentName = node.name.name;
        const targetAttr = GATED_COMPONENTS[componentName];
        if (!targetAttr) return;

        const handlerAttr = node.attributes.find(
          (attr) => attr.type === 'JSXAttribute' && attr.name && attr.name.name === targetAttr,
        );
        if (!handlerAttr) return;

        if (hasDisabledProp(node)) return;
        if (isInsidePermissionAncestor(node)) return;

        const value = handlerAttr.value;
        if (!value || value.type !== 'JSXExpressionContainer') return;
        if (isGatingHandler(value.expression)) return;

        context.report({
          node: handlerAttr,
          messageId: 'requireGate',
          data: { component: componentName },
        });
      },
    };
  },
};
