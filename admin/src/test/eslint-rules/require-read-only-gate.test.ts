import { RuleTester } from 'eslint';
// @ts-expect-error — rule lives outside the tsconfig include and ships as .js
import rule from '../../../eslint-rules/require-read-only-gate.js';

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

tester.run('require-read-only-gate', rule, {
  valid: [
    // Chip without onDelete — rule does not engage
    { code: '<Chip label="foo" />' },

    // Chip with disabled prop (any form is accepted as static evidence the author considered gating)
    { code: '<Chip onDelete={handler} disabled />' },
    { code: '<Chip onDelete={handler} disabled={!canWrite} />' },
    { code: '<Chip onDelete={handler} disabled={readOnly} />' },

    // Chip with a conditional handler — author is gating per-call
    { code: '<Chip onDelete={canWrite ? handler : undefined} />' },
    { code: '<Chip onDelete={readOnly ? undefined : handler} />' },

    // Chip whose onDelete passes through useReadOnly().gate(...)
    { code: 'const { gate } = useReadOnly(); <Chip onDelete={gate(handler)} />' },
    { code: 'const ro = useReadOnly(); <Chip onDelete={ro.gate(handler)} />' },

    // Chip with explicit undefined — affordance never enabled
    { code: '<Chip onDelete={undefined} />' },

    // Autocomplete equivalents
    { code: '<Autocomplete onChange={handler} disabled />' },
    { code: '<Autocomplete onChange={canWrite ? handler : undefined} />' },
    { code: 'const { gate } = useReadOnly(); <Autocomplete onChange={gate(handler)} />' },

    // Other components — rule does not apply
    { code: '<Button onClick={handler} />' },
    { code: '<TextField onChange={handler} />' },

    // Inline ancestor gating: {<predicate> && <X />} where predicate is a recognized permission name
    { code: '<div>{canWrite && <Autocomplete onChange={handler} />}</div>' },
    { code: '<div>{isAdmin && <Chip onDelete={handler} />}</div>' },
    { code: '<div>{!readOnly && <Autocomplete onChange={handler} />}</div>' },
    { code: '<div>{selectedSiteId && canWrite && <Autocomplete onChange={handler} />}</div>' },
  ],
  invalid: [
    {
      code: '<Chip onDelete={handler} />',
      errors: [{ messageId: 'requireGate' }],
    },
    {
      code: '<Chip label="foo" onDelete={() => mutate(id)} />',
      errors: [{ messageId: 'requireGate' }],
    },
    {
      code: '<Autocomplete onChange={handleChange} />',
      errors: [{ messageId: 'requireGate' }],
    },
    {
      code: '<Autocomplete options={opts} onChange={(_, v) => setValue(v)} />',
      errors: [{ messageId: 'requireGate' }],
    },
  ],
});
