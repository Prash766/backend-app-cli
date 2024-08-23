#!/usr/bin/env node

import fs from 'fs'
import chalk from "chalk"
import inquirer from "inquirer"
import { getLatestVersion } from './api/api.js'

const log= console.log

const questions=[
    {
        type:"input",
        name:"name",
        message:"Whats your project name?",
        default:"myapp"
    },
    {
        type:"confirm",
        name:"useCors",
        message:"Do you want to enable CORS?",
        default:false
    },
    {
        type:"confirm",
        name:"useErrorHandler",
        message:"Do you want to use a basic Error Handler?",
        default:false
    },
    {
        type:"confirm",
        name:"useEnvFile",
        message:"Do you want to use an environment file?",
        default:false
    },
]


const ErrorMiddleware = `import {envMode} from ../app.js 

export const errorMiddleware = (err, req, res , next)=>{

    err.message||= "Internal Server Error"
    err.statusCode= err.statusCode || 500

    const response ={
    success:false,
    message:err.message,
    }
    
    if(envMode==="DEVELOPMENT){
    response.error= err
    }

    return res.status(err.statusCode).json(response)

    }

    export const TryCatch = (passedFuc)=> async(req,res,next){
    try{
    await passedFunc(req, res, next)
    }
    catch(error){
    next(error)
    }

    }
`

const ErrorHandler= `export default class ErrorHandler extends Error{
constructor(message , statusCode){
super(this.message)
this.statusCode = statusCode
}
}
`


async function createApp(){
  try {
      const answer  = await inquirer.prompt(questions)
  
      const projectName = answer.name
      const dir = `/${projectName}`
      const fileExtension = "js"
  
      if(!fs.existsSync(dir)){
          fs.mkdirSync(dir)
          fs.mkdirSync(`${dir}/routes`)
          fs.mkdirSync(`${dir}/models`)
          fs.mkdirSync(`${dir}/controllers`)
          fs.mkdirSync(`${dir}/middlewares`)
          fs.mkdirSync(`${dir}/utils`)
          fs.mkdirSync(`${dir}/utils`)
          fs.mkdirSync(`${dir}/lib`)
      }
      if(answer.useErrorHandler){
          fs.writeFileSync(`${dir}/middleware/error.js` , ErrorMiddleware)
          fs.writeFileSync(`${dir}/utils/errorHandler.js` , ErrorHandler)
      }
  
      const importLines=['import express from "express']
      const middlewareLines =[
          `app.use(express.json())`,
          `app.use(express.urlencoded({extended:true}))`
      ]
  
      if(answer.useCors){
          importLines.push(`import cors from "cors"`)
          middlewareLines.push(`app.use(cors({
              origin:*,
              credentials:true
      }))`)   
      }
      if(answer.useErrorHandler){
          importLines.push(`import {ErrorHandler} from './middleware/error.js'`)
      }
      if(answer.useEnvFile){
          importLines.push(`import dotenv from 'dotenv`)
          const envFileContent = `PORT=4000`
        fs.writeFileSync(`${projectDir}/.env`, envFileContent)
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
  
    // your routes here
  
    
    app.get("*", (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Page not found'
      })
    })
  
    ${answer.useErrorHandler ? "app.use(errorMiddleware)" : ""}
    
    
    app.listen(port, () => console.log('Server is working on Port:'+port+' in '+envMode+' Mode.'))`
    fs.writeFileSync(`${projectDir}/app.${fileExtension}`, baseFileContent)
  
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
     "main": ${ '"app.js"'},
     "scripts": ${
    npmScriptsJs
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
          ${
            answer.framework === "TypeScript"
              ? devDependencies.join(",")
              : devDependencies[0]
          }
        }
      
      }`;
  
    fs.writeFileSync(`${projectDir}/package.json`, packageJsonContent);
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


createApp().catch((err)=> {
    console.error(err)}
)