
import {
    KernelGlobal,
    KernelFunction, KernelConstant, KernelVariable,
    KernelFunctionSignatureArgumentInterface,
    Language
} from '../src/defintions';
import {
    FileAST, Node,
    Decl, ArrayDecl, TypeDecl, FuncDecl,
    ID, InitList, FuncDef, InOutDecl
} from './ast';
import { Linker } from '../src/linker';

function getValueFromExpression(node: Node) {
    let str = node.exportAsWebGL();
    if (str.endsWith('f')) {
        str = str.slice(0, -1);
    }
    if (str.endsWith('.')) {
        str += '0';
    }
    return str;
}

function tsStringifyValue(
    array: string | string[] | KernelFunctionSignatureArgumentInterface
): string {
    return JSON.stringify(array).replace(/"/g, '\'');
}

interface ExportableInterface {
    exportAsScript(): string;
}

abstract class ExportableKernelGlobal
         extends KernelGlobal
         implements ExportableInterface {
    constructorName: string;

    constructor(constructorName: string, node: Decl) {
        const name = node.name;
        const isArray = node.type instanceof ArrayDecl;

        const typeDecl = isArray ? node.type.type : node.type;
        if (!(typeDecl instanceof TypeDecl)) {
            throw new Error('unreachable');
        }
        const type = typeDecl.type.names[0];
        let value, valueString;

        if (isArray) {
            if (node.init instanceof InitList && type === 'float') {
                const values = node.init.exprs.map(getValueFromExpression);

                valueString = `${values.join(', ')}`;
                value = new Float32Array(JSON.parse(`[${valueString}]`));
            } else {
                throw new Error(`unsupported array type ${type}`);
            }
        } else {
            valueString = getValueFromExpression(node.init);
            value = JSON.parse(valueString);
        }

        super({ name, type, value, valueString });
        this.constructorName = constructorName;
    }

    static match(node: Node): node is Decl {
        return (node instanceof Decl &&
                node.storage.indexOf('extern') === -1 &&
                node.init !== null);
    }

    exportAsScript(): string {
        let valueIdentifer;
        if (this.value instanceof Float32Array) {
            valueIdentifer = `new Float32Array([${this.valueString}])`;
        } else {
            valueIdentifer = `${this.valueString}`;
        }

        return `linker.add(new ${this.constructorName}({\n` +
        `  name: ${tsStringifyValue(this.name)},\n` +
        `  type: ${tsStringifyValue(this.type)},\n` +
        `  value: ${valueIdentifer},\n` +
        `  valueString: ${tsStringifyValue(this.valueString)}\n` +
        `}));`;
    }
}

export class ExportableKernelConstant extends ExportableKernelGlobal implements KernelConstant {
    kernelType: 'Constant' = 'Constant';

    constructor(node: Decl) {
        super('KernelConstant', node);
    }

    static match(node: Node): node is Decl {
        return (ExportableKernelGlobal.match(node) &&
                /^([0-9a-z]+_)?[0-9A-Z]+$/.test(node.name));
    }

    exportAsWebGL(): string {
        return KernelConstant.prototype.exportAsWebGL.call(this);
    }

    exportAsJS(): string {
        return KernelConstant.prototype.exportAsJS.call(this);
    }
}

export class ExportableKernelVariable extends ExportableKernelGlobal implements KernelVariable {
    kernelType: 'Variable' = 'Variable';

    constructor(node: Decl) {
        super('KernelVariable', node);
    }

    static KNOWN_VARIABLES = new Set(['sgngamf']);

    static match(node: Node): node is Decl {
        return (ExportableKernelGlobal.match(node) &&
                ExportableKernelVariable.KNOWN_VARIABLES.has(node.name));
    }

    exportResetAs(language: Language): string {
        return KernelVariable.prototype.exportResetAs.call(this, language);
    }

    exportResetAsWebGL(): string {
        return KernelVariable.prototype.exportResetAsWebGL.call(this);
    }

    exportResetAsJS(): string {
        return KernelVariable.prototype.exportResetAsJS.call(this);
    }

    exportAsWebGL(): string {
        return KernelVariable.prototype.exportAsWebGL.call(this);
    }

    exportAsJS(): string {
        return KernelVariable.prototype.exportAsJS.call(this);
    }
}

export class ExportableKernelFunction extends KernelFunction implements ExportableInterface {
    constructor(allFunctions: Set<string>, allConstants: Set<string>,
                allVariables: Set<string>, node: FuncDef) {
        if (!(node.decl.type instanceof FuncDecl)) {
            throw new TypeError('expected FuncDecl type');
        }

        const dependencies = new Set<string>();
        const constants = new Set<string>();
        const variables = new Set<string>();
        const codeWebGL = node.exportAsWebGL();
        const codeJS = node.exportAsJS();

        node.body.transformChildren(function scan(child) {
            if (child instanceof ID) {
                if (allFunctions.has(child.name)) {
                    dependencies.add(child.name);
                } else if (allConstants.has(child.name)) {
                    constants.add(child.name);
                } else if (allVariables.has(child.name)) {
                    variables.add(child.name);
                }
            }

            child.transformChildren(scan);
            return child;
        });

        let parameters: Decl[] = [];
        if (node.decl.type.args !== null) {
            parameters = node.decl.type.args.params
                .filter((arg): arg is Decl => arg instanceof Decl);
        }

        const signature = {
            'name': node.decl.name,
            'type': node.decl.type.type.type.exportAsWebGL(),
            'arguments': parameters
                .map(function arg(arg, index) {
                    let argType = arg.type.type.exportAsWebGL();
                    if (arg.type instanceof InOutDecl) {
                        argType = `inout ${arg.type.type.type.exportAsWebGL()}`;
                    }

                    return {
                        'name': arg.name,
                        'type': argType,
                        'index': index
                    };
                })
        };

        super({
            'dependencies': Array.from(dependencies),
            'constants': Array.from(constants),
            'variables': Array.from(variables),
            'signature': signature,
            'codeWebGL': codeWebGL,
            'codeJS': codeJS
        });
    }

    static match(node: Node): node is FuncDef {
        return (node instanceof FuncDef);
    }

    exportAsScript(): string {
        return `linker.add(new KernelFunction({\n` +
        `  dependencies: ${tsStringifyValue(this.dependencies)},\n` +
        `  constants: ${tsStringifyValue(this.constants)},\n` +
        `  variables: ${tsStringifyValue(this.variables)},\n` +
        `  signature: {\n` +
        `    name: ${tsStringifyValue(this.signature.name)},\n` +
        `    type: ${tsStringifyValue(this.signature.type)},\n` +
        `    arguments: [\n` +
        `      ${this.signature.arguments
                  .map((arg) => tsStringifyValue(arg))
                  .join(',\n      ')},\n` +
        `    ],\n` +
        `  },\n` +
        `  codeWebGL: \`${this.codeWebGL}\`,\n` +
        `  codeJS: \`${this.codeJS}\`,\n` +
        `}));`;
    }
}

declare type Exportable = ExportableKernelConstant | ExportableKernelVariable |
                          ExportableKernelFunction;

export class ExportableScript implements ExportableInterface {
    exportables: Map<string, Exportable>;

    constructor(ast: FileAST) {
        const allFunctions = new Set<string>(
            ['mtherr', 'float', 'int', 'bool']
        );
        const allConstants = new Set<string>();
        const allVariables = new Set<string>();

        for (const child of ast.ext) {
            if (child instanceof Decl &&
                ExportableKernelVariable.KNOWN_VARIABLES.has(child.name)) {
                allVariables.add(child.name);
            } else if (child instanceof Decl &&
                       child.type instanceof FuncDecl) {
                allFunctions.add(child.name);
            } else if (child instanceof FuncDef) {
                allFunctions.add(child.decl.name);
            } else if (child instanceof Decl) {
                allConstants.add(child.name);
            } else {
                throw new Error('unreachable');
            }
        }

        this.exportables = new Map();
        for (const child of ast.ext) {
            let exportable = null;

            if (ExportableKernelConstant.match(child)) {
                exportable = new ExportableKernelConstant(child);
            } else if (ExportableKernelVariable.match(child)) {
                exportable = new ExportableKernelVariable(child);
            } else if (ExportableKernelFunction.match(child)) {
                exportable = new ExportableKernelFunction(
                    allFunctions, allConstants, allVariables, child);
            }

            if (exportable !== null) {
                this.exportables.set(exportable.name, exportable);
            }
        }
    }

    addToLinker(linker: Linker) {
        for (const kernelPart of this.exportables.values()) {
            linker.add(kernelPart);
        }
    }

    reduceExportables(keepSymbols: Set<string>) {
        for (const kernelSymbol of this.exportables.keys()) {
            if (!keepSymbols.has(kernelSymbol)) {
                this.exportables.delete(kernelSymbol);
            }
        }
    }

    hasContent(): boolean {
        return this.exportables.size > 0;
    }

    exportAsScript(): string {
        const defintionsImports = new Set<string>();

        for (const exportable of this.exportables.values()) {
            if (exportable instanceof ExportableKernelConstant) {
                defintionsImports.add('KernelConstant');
            } else if (exportable instanceof ExportableKernelVariable) {
                defintionsImports.add('KernelVariable');
            } else if (exportable instanceof ExportableKernelFunction) {
                defintionsImports.add('KernelFunction');
            }
        }

        const imports = [];
        if (defintionsImports.size > 0) {
            imports.push(
                `import { `
                    + Array.from(defintionsImports).join(', ') +
                ` } from '../defintions';`
            );
            imports.push(`import { linker } from '../linker';`);
        }

        return [
            '// tslint:disable:max-line-length',
            imports.join('\n'),
            ...Array.from(this.exportables.values())
                .map((exportable) => exportable.exportAsScript())
        ].join('\n\n');
    }
}
