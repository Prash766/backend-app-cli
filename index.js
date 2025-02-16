#!/usr/bin/env node

import fs from 'fs'
import chalk from "chalk"
import inquirer from "inquirer"
import { getLatestVersion } from './api/api.js'

const questions = [
  {
    type: "input",
    name: "name",
    message: "What's your project name?",
    default: "myapp"
  },
  {
    type: "list",
    name: "language",
    message: "What backend template do you want - JavaScript or TypeScript?",
    choices: ['JavaScript', 'TypeScript'],
  },
  {
    type: "confirm",
    name: "useCors",
    message: "Do you want to enable CORS?",
    default: false
  },
  {
    type: "confirm",
    name: "useErrorHandler",
    message: "Do you want to use Error Handlers?",
    default: false
  },
  {
    type: "confirm",
    name: "useEnvFile",
    message: "Do you want to use an environment file?",
    default: false
  },
]

const ErrorMiddlewareJS = `import { envMode } from '../app.js';

export const errorMiddleware = (err, req, res, next) => {
    err.message = err.message || "Internal Server Error";
    err.statusCode = err.statusCode || 500;

    const response = {
        success: false,
        message: err.message,
    };
    
    if (envMode === "DEVELOPMENT") {
        response.error = err;
    }

    return res.status(err.statusCode).json(response);
};
`;

const errorMiddlewareTS = `import { Request, Response, NextFunction } from 'express';
import { envMode } from '../app';
import { ApiError } from '../utils/ApiError';
import { ZodError } from 'zod';

export const errorMiddleware = (
    err: ApiError | ZodError | Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let message = "Internal Server Error";
    let status = 500;

    if (envMode === "DEVELOPMENT") {
        message = err.message;
    } else if (err instanceof ApiError) {
        message = err.message;
        status = err.status;
    } else if (err instanceof ZodError) {
        message = err.message;
        status = 400;
    }

    res.status(status).json({
        success: false,
        message: message
    });
};
`;

const asyncHandlerJS = `const asyncHandler = (requestHandler) => {
    return (req, res, next) => 
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
};

export default asyncHandler;
`;

const asyncHandlerTS = `import { Request, Response, NextFunction } from 'express';

type AsyncFunction = (
    req: Request,
    res: Response,
    next: NextFunction
) => Promise<any>;

export const asyncHandler = (fn: AsyncFunction) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch((err) => next(err));
    };
};
`;

const ErrorHandlerJS = `class ApiError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}

export default ApiError;
`;

const ErrorHandlerTS = `export class ApiError extends Error {
    status: number;
    
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}
`;

const tsConfigContent = `{
    "compilerOptions": {
    "target": "es2016",                                  
    "module": "commonjs",                                
    "esModuleInterop": true,                          
        "outDir": "./dist",
        "rootDir": "./src",
        "strict": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules"]
}`;

async function createApp() {
  try {
    const answer = await inquirer.prompt(questions);

    const projectName = answer.name;
    const dir = `${process.cwd()}/${projectName}`;
    const isTypeScript = answer.language === "TypeScript";
    const fileExtension = isTypeScript ? 'ts' : 'js';

    // Create base directory
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);

      if (isTypeScript) {
        // TypeScript directory structure
        fs.mkdirSync(`${dir}/src`);
        fs.mkdirSync(`${dir}/src/middleware`);
        fs.mkdirSync(`${dir}/src/controllers`);
        fs.mkdirSync(`${dir}/src/routes`);
        fs.mkdirSync(`${dir}/src/utils`);
        fs.mkdirSync(`${dir}/src/lib`);
        fs.mkdirSync(`${dir}/dist`);

        // Create tsconfig.json
        fs.writeFileSync(`${dir}/tsconfig.json`, tsConfigContent);

        if (answer.useErrorHandler) {
          fs.writeFileSync(`${dir}/src/utils/asyncHandler.ts`, asyncHandlerTS);
          fs.writeFileSync(`${dir}/src/utils/ApiError.ts`, ErrorHandlerTS);
          fs.writeFileSync(`${dir}/src/middleware/error.middleware.ts`, errorMiddlewareTS);
        }
      } else {
        // JavaScript directory structure
        fs.mkdirSync(`${dir}/routes`);
        fs.mkdirSync(`${dir}/models`);
        fs.mkdirSync(`${dir}/controllers`);
        fs.mkdirSync(`${dir}/middlewares`);
        fs.mkdirSync(`${dir}/utils`);
        fs.mkdirSync(`${dir}/lib`);

        if (answer.useErrorHandler) {
          fs.writeFileSync(`${dir}/middlewares/error.js`, ErrorMiddlewareJS);
          fs.writeFileSync(`${dir}/utils/errorHandler.js`, ErrorHandlerJS);
          fs.writeFileSync(`${dir}/utils/asyncHandler.js`, asyncHandlerJS);
        }
      }
    }

    const importLines = ['import express from "express"'];
    if (isTypeScript) {
      importLines.push('import { Request, Response, NextFunction } from "express"');
    }

    const middlewareLines = [
      `app.use(express.json())`,
      `app.use(express.urlencoded({ extended: true }))`
    ];

    if (answer.useCors) {
      importLines.push(`import cors from "cors"`);
      middlewareLines.push(`app.use(cors({
    origin: "*",
    credentials: true
}))`);
    }

    if (answer.useErrorHandler) {
      if (isTypeScript) {
        importLines.push(`import { errorMiddleware } from './middleware/error.middleware'`);
      } else {
        importLines.push(`import { errorMiddleware } from './middlewares/error.js'`);
      }
    }

    if (answer.useEnvFile) {
      importLines.push(`import dotenv from 'dotenv'`);
      const envFileContent = `PORT=4000\nNODE_ENV=DEVELOPMENT`;
      fs.writeFileSync(`${dir}/.env`, envFileContent);
    }

    const baseFileContent = `${importLines.join("\n")}

${answer.useEnvFile ? "dotenv.config()" : ""}

export const envMode = process.env.NODE_ENV?.trim() || 'DEVELOPMENT';
const port = process.env.PORT || 3000;

const app = express();

${middlewareLines.join("\n")}

app.get('/', (req${isTypeScript ? ": Request" : ""}, res${isTypeScript ? ": Response" : ""}) => {
    res.send('Hello, World!');
});

// Define your routes here

app.get('*', (req${isTypeScript ? ": Request" : ""}, res${isTypeScript ? ": Response" : ""}) => {
    res.status(404).json({
        success: false,
        message: 'Page not found'
    });
});

${answer.useErrorHandler ? "app.use(errorMiddleware);" : ""}

app.listen(port, () => {
    console.log(\`Server is running on Port: \${port} in \${envMode} Mode.\`);
});`;

    const appPath = isTypeScript ? `${dir}/src/app.ts` : `${dir}/app.js`;
    fs.writeFileSync(appPath, baseFileContent);

    const dependencies = ["express"];
    const devDependencies = ["nodemon"];
    dependencies.push("zod")

    if (answer.useCors) dependencies.push("cors");
    if (answer.useEnvFile) dependencies.push("dotenv");

    if (isTypeScript) {
      devDependencies.push(
        "typescript",
        "@types/node",
        "@types/express",
        "ts-node",
      );
      if (answer.useCors) devDependencies.push("@types/cors");
    }

    // Get latest versions
    const dependencyVersions = await Promise.all(
      dependencies.map(dep => getLatestVersion(dep))
    );

    const devDependencyVersions = await Promise.all(
      devDependencies.map(dep => getLatestVersion(dep))
    );

    const npmScripts = isTypeScript ? {
      "start": "node dist/app.js",
      "dev": "nodemon",
      "build": "tsc"
    } : {
      "start": "NODE_ENV=PRODUCTION node app.js",
      "dev": "nodemon app.js"
    };

    let packageJsonContent = {
      name: projectName,
      version: "1.0.0",
      description: "",
      main: isTypeScript ? "./src/app.ts" : "app.js",
      scripts: npmScripts,
      keywords: [],
      author: "",
      license: "ISC",
      dependencies: Object.fromEntries(
        dependencyVersions.map(({ name, version }) => [name, version])
      ),
      devDependencies: Object.fromEntries(
        devDependencyVersions.map(({ name, version }) => [name, version])
      )
    };
    if (fileExtension === 'js') {
      packageJsonContent = {
        ...packageJsonContent,
        type: "module"
      }
    }

    fs.writeFileSync(
      `${dir}/package.json`,
      JSON.stringify(packageJsonContent, null, 2)
    );

    console.log("\n");
    console.log(
      chalk.bgWhite(
        chalk.black(` 🎉 Project '${projectName}' created successfully! 🎉 `)
      )
    );
    console.log("\n");
    console.log(chalk.magentaBright(chalk.italic("Next Steps:")));
    console.log(chalk.bold(`1. cd ${projectName}`));
    console.log(chalk.bold(`2. npm install`));
    console.log(chalk.bold(`3. npm run dev`));
    console.log("\n");

  } catch (error) {
    console.error("Error creating project:", error);
    process.exit(1);
  }
}

createApp().catch((err) => {
  console.error("Failed to create project:", err);
  process.exit(1);
});