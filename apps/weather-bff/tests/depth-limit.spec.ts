import { describe, it, expect } from 'vitest';
import { buildSchema, parse, validate } from 'graphql';
import { depthLimit } from '../src/graphql/depth-limit';

const schema = buildSchema(`
  type Query { me: User }
  type User { name: String, friends: [User!] }
`);

function errorsFor(query: string, max: number): readonly unknown[] {
  return validate(schema, parse(query), [depthLimit(max)]);
}

describe('depthLimit', () => {
  it('allows queries within the limit', () => {
    expect(errorsFor('{ me { name } }', 2)).toHaveLength(0);
  });

  it('rejects queries deeper than the limit', () => {
    const errors = errorsFor('{ me { friends { friends { name } } } }', 2);
    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toContain('maximum depth of 2');
  });

  it('counts depth reached through fragment spreads', () => {
    const query = `
      { me { ...F } }
      fragment F on User { friends { friends { name } } }
    `;
    expect(errorsFor(query, 2)).toHaveLength(1);
  });
});
