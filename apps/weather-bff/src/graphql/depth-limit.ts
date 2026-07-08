import type { ValidationRule } from 'graphql';
import {
  GraphQLError,
  Kind,
  type FieldNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
} from 'graphql';

/**
 * Rejects queries nested deeper than `maxDepth`. Defence-in-depth against
 * abusive/expensive documents; resolves fragment spreads so they can't be used
 * to smuggle extra depth past the limit.
 */
export function depthLimit(maxDepth: number): ValidationRule {
  return (context) => {
    const fragments: Record<string, FragmentDefinitionNode> = {};
    for (const def of context.getDocument().definitions) {
      if (def.kind === Kind.FRAGMENT_DEFINITION) fragments[def.name.value] = def;
    }

    const measure = (selectionSet: SelectionSetNode, depth: number): number => {
      let max = depth;
      for (const selection of selectionSet.selections) {
        if (selection.kind === Kind.FIELD) {
          const field = selection as FieldNode;
          if (field.selectionSet) {
            max = Math.max(max, measure(field.selectionSet, depth + 1));
          }
        } else if (selection.kind === Kind.INLINE_FRAGMENT) {
          max = Math.max(max, measure(selection.selectionSet, depth));
        } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
          const fragment = fragments[selection.name.value];
          if (fragment) max = Math.max(max, measure(fragment.selectionSet, depth));
        }
      }
      return max;
    };

    return {
      OperationDefinition(node) {
        if (!node.selectionSet) return;
        const depth = measure(node.selectionSet, 0);
        if (depth > maxDepth) {
          context.reportError(
            new GraphQLError(
              `Query exceeds maximum depth of ${maxDepth} (got ${depth}).`,
              { nodes: [node], extensions: { code: 'QUERY_TOO_DEEP' } },
            ),
          );
        }
      },
    };
  };
}
