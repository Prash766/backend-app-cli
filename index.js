#!/usr/bin/env node

import fs from 'fs'
import chalk from "chalk"
import inquirer from "inquirer"
import { getLatestVersion } from './api/api.js'


const questions = [
  {
    type: "input",
    name: "name",
    message: "Whats your project name?",
    default: "myapp"
  },
  {
    type:"list",
    name:"language",
    message:"What backend template you want Javascript or Typescript?",
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
    message: "Do you want to use a Error Handlers?",
    default: false
  },
  {
    type: "confirm",
    name: "useEnvFile",
    message: "Do you want to use an environment file?",
    default: false
  },
]


const ErrorMiddlewareJS = `import {envMode} from '../app.js'

export const errorMiddleware = (err, req, res , next)=>{

    err.message||= "Internal Server Error"
    err.statusCode= err.statusCode || 500

    const response ={
    success:false,
    message:err.message,
    }
    
    if(envMode==="DEVELOPMENT"){
    response.error= err
    }

    return res.status(err.statusCode).json(response)

    }
`
const asyncHandlerJS = `const asyncHandler = (requestHandler)=>{
  return (req , res ,next )=> Promise.resolve(requestHandler(req , res , next).catch(err=> next(err)))}
}
`
const asyncHandlerTS = `import {Request , Response , NextFunction} from  'express'
const asyncHandler = (fn:(req: Request , res : Response , next: NextFunction))=>{
  return (req , res , next)=> Promise.resolve(fn(req ,res, next)).catch(err=> next(err))
  }
`

const ErrorHandlerJS = `export default class ApiError extends Error{
constructor(message , statusCode){
super(message)
this.statusCode = statusCode
}
}
`

const ErrorHandlerTS= `export default const class ApiError extends Error{
status : number
constructor(
message : string,
status : number
){
super(message)
this.status= status
}
}
`


async function createApp() {
  try {
    const answer = await inquirer.prompt(questions)

    const projectName = answer.name
    const dir = `${process.cwd()}/${projectName}`;

    const fileExtension = answer.language === "Javascript" ? 'js' : 'ts'

    if(fileExtension==='js'){
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
        fs.mkdirSync(`${dir}/routes`)
        fs.mkdirSync(`${dir}/models`)
        fs.mkdirSync(`${dir}/controllers`)
        fs.mkdirSync(`${dir}/middlewares`)
        fs.mkdirSync(`${dir}/utils`)
        fs.mkdirSync(`${dir}/lib`)
      }
      if (answer.useErrorHandler) {
        fs.writeFileSync(`${dir}/middlewares/error.js`, ErrorMiddlewareJS)
        fs.writeFileSync(`${dir}/utils/errorHandler.js`, ErrorHandler)
        fs.writeFileSync(`${dir}/utils/asyncHandler.js`, asyncHandlerJS)
      }
    }else if(fileExtension==="TypeScript"){
      if(!fs.existsSync(dir)){

        fs.writeFileSync(`${dir}/dist`)
        fs.writeFileSync(`${dir}/src/middleware`)
        fs.writeFileSync(`${dir}/src/controllers`)
        fs.writeFileSync(`${dir}/src/routes`)
        fs.writeFileSync(`${dir}/src/utils`)
        fs.writeFileSync(`${dir}/src/lib`)
        if(answer.useErrorHandler){
          fs.writeFileSync(`${dir}/utils/asyncHandler.ts`, asyncHandlerTS)
          fs.writeFileSync(`${dir}/utils/ApiError.ts`, ErrorHandlerTS)
        }
      }

    }

    const importLines = ['import express from "express"']
    const middlewareLines = [
      `app.use(express.json())`,
      `app.use(express.urlencoded({extended:true}))`
    ]

    if (answer.useCors) {
      importLines.push(`import cors from "cors"`)
      middlewareLines.push(`app.use(cors({
              origin:"*',
              credentials:true
      }))`)
    }
    if (answer.useErrorHandler) {
      importLines.push(`import {errorMiddleware} from './middleware/error.js'`)
    }
    if (answer.useEnvFile) {
      importLines.push(`import dotenv from 'dotenv`)
      const envFileContent = `PORT=4000`
      fs.writeFileSync(`${dir}/.env`, envFileContent)
    }
    const baseFileContent = `${importLines.join("\n")}
        ${answer.useEnvFile ? "dotenv.config({path: './.env',})" : ""}
          export const envMode = process.env.NODE_ENV?.trim() || 'DEVELOPMENT'
    const port = process.env.PORT || 3000
  
  
    const app = express()
  
  
   ${middlewareLines.join("\n")} 
  
  
    app.get('/', (req, res) => {
      res.send('Hello, World!')
    })
  
    // Define your routes here
  
    
    app.get("*", (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Page not found'
      })
    })
  
    ${answer.useErrorHandler ? "app.use(errorMiddleware)" : ""}
    
    
    app.listen(port, () => console.log('Server is working on Port:'+port+' in '+envMode+' Mode.'))`
    fs.writeFileSync(`${dir}/app.${fileExtension}`, baseFileContent)

    const dependenciesPromise = [getLatestVersion("express")]

    if (answer.useCors)
      dependenciesPromise.push(getLatestVersion("cors"))

    if (answer.useEnvFile)
      dependenciesPromise.push(getLatestVersion("dotenv"));

    const devDependenciesPromise = [
      getLatestVersion("nodemon"),
    ]


    const dependenciesRaw = await Promise.all(dependenciesPromise);
    const devDependenciesRaw = await Promise.all(devDependenciesPromise);
    const dependencies = dependenciesRaw.map(
      (dependency) => `"${dependency.name}": "${dependency.version}"`
    );

    const devDependencies = devDependenciesRaw.map(
      (dependency) => `"${dependency.name}": "${dependency.version}"`
    );

    const npmScriptsJs = JSON.stringify({
      start: "set NODE_ENV=PRODUCTION & node app.js",
      dev: "npx nodemon app.js",
    });


    const packageJsonContent = `{
     "name": "${projectName}",
     "version": "1.0.0",
     "description": "",
     "main": ${'"app.js"'},
     "scripts": ${npmScriptsJs
      }
     ,
     "keywords": [],
     "author": "",
     "type": "module",
     "license": "ISC",
     "dependencies": {
        ${dependencies.join(",")}
     }, 
        "devDependencies": {
          ${devDependencies[0]
      }
        }
      
      }`;

    fs.writeFileSync(`${dir}/package.json`, packageJsonContent);
    console.log("\n");
    console.log(
      chalk.bgWhite(
        chalk.black(` 🎉 Project '${projectName}' created successfully! 🎉 `)
      )
    );
    console.log("\n");
    console.log(chalk.magentaBright(chalk.italic("Next Steps:")));
    console.log(chalk.bold(`-> cd ${projectName}`));
    console.log(chalk.bold(`-> npm install \n`));
    console.log(chalk.greenBright(chalk.italic("Start your server: ")));
    console.log(chalk.bold(`1- npm run dev 🚀\n`));
  } catch (error) {
    console.error(error);
  }

}


createApp().catch((err) => {
  console.error(err)
}
)