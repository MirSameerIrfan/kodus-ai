export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);
  
  // Track if we need to add the new createLogger import
  let needsNewImport = false;

  // --- Step 1: Process Classes (Refactor Constructor) ---
  root.find(j.ClassDeclaration).forEach((path) => {
    const className = path.node.id.name;
    const classBodyNodes = path.node.body.body;
    let loggerWasRemoved = false;

    // Manually find constructor
    const constructorNode = classBodyNodes.find(
      (node) => node.kind === 'constructor'
    );

    if (constructorNode) {
      const params = constructorNode.params;
      const newParams = params.filter((param) => {
        let paramName = null;
        
        // Handle TSParameterProperty (private readonly logger)
        if (param.type === 'TSParameterProperty') {
          if (param.parameter.type === 'Identifier') {
            paramName = param.parameter.name;
          }
        } 
        // Handle normal Identifier
        else if (param.type === 'Identifier') {
          paramName = param.name;
        }

        if (paramName === 'logger') {
          loggerWasRemoved = true;
          return false; // Remove 'logger' param
        }
        return true; // Keep others
      });
      constructorNode.params = newParams;
    }

    // Add Property if needed
    if (loggerWasRemoved) {
      needsNewImport = true; 

      // createLogger(ClassName.name)
      const propertyValue = j.callExpression(j.identifier('createLogger'), [
        j.memberExpression(j.identifier(className), j.identifier('name')),
      ]);

      const classProperty = j.classProperty(
        j.identifier('logger'),
        propertyValue,
        null
      );

      classProperty.accessibility = 'private';
      classProperty.readonly = true;

      // Unshift to top of class body
      classBodyNodes.unshift(classProperty);
    }
  });

  // --- Step 2: Add 'createLogger' Import (Only if needed) ---
  if (needsNewImport) {
    const importSource = '@kodus/flow';
    const specifierName = 'createLogger';

    // Find all imports from @kodus/flow
    const flowImports = root.find(j.ImportDeclaration, {
      source: { value: importSource },
    });

    let alreadyImported = false;
    flowImports.forEach((path) => {
      const hasIt = path.node.specifiers.some(
        (spec) => spec.imported && spec.imported.name === specifierName
      );
      if (hasIt) alreadyImported = true;
    });

    if (!alreadyImported) {
      if (flowImports.size() > 0) {
        // Add to the FIRST existing import
        const firstImport = flowImports.at(0);
        firstImport.forEach((path) => {
             path.node.specifiers.push(
                j.importSpecifier(j.identifier(specifierName))
             );
        });
      } else {
        // Create new import at top
        root.get().node.program.body.unshift(
          j.importDeclaration(
            [j.importSpecifier(j.identifier(specifierName))],
            j.literal(importSource)
          )
        );
      }
    }
  }

  // --- Step 3: Cleanup 'PinoLoggerService' Import (Runs ALWAYS) ---
  root.find(j.ImportDeclaration).forEach((path) => {
    const specifiers = path.node.specifiers;
    
    // Filter out PinoLoggerService from any import that has it
    const newSpecifiers = specifiers.filter((spec) => {
        return !(
            spec.type === 'ImportSpecifier' && 
            spec.imported.name === 'PinoLoggerService'
        );
    });

    // If the list of specifiers changed, we removed something
    if (newSpecifiers.length !== specifiers.length) {
        path.node.specifiers = newSpecifiers;

        // If no specifiers left (empty import line), remove the whole line
        if (newSpecifiers.length === 0) {
            j(path).remove();
        }
    }
  });

  return root.toSource();
}