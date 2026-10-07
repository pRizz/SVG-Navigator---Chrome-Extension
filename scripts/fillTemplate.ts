/**
 * Replaces each `{{name}}` in `template` with `values[name]`, inserted verbatim.
 *
 * @throws if the template uses a name that `values` lacks, so a typo cannot
 * silently leave a placeholder in the output.
 */
export function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_placeholder, name: string) => {
        const maybeValue = values[name];
        if (maybeValue === undefined) {
            throw new Error(`Template uses {{${name}}}, which has no value`);
        }
        return maybeValue;
    });
}
