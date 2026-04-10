import { defineConfig } from "vite"
import fs from "fs"
import path from "path"

/**
 * Vite plugin to enable writing level data to files during development.
 * This allows the Level Designer to persist changes to disk.
 */
function levelFileWriterPlugin() {
  return {
    name: "level-file-writer",
    configureServer(server) {
      
      // Endpoint for writing JSON level files during development
      server.middlewares.use("/__write_levels__", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405
          res.end("Method not allowed")
          return
        }

        let body = ""
        req.on("data", chunk => {
          body += chunk.toString()
        })

        req.on("end", async () => {
          try {
            const { path: filePath, content } = JSON.parse(body)

            // Security restriction
            if (!filePath.startsWith("public/levels/")) {
              res.statusCode = 403
              res.end("Forbidden")
              return
            }

            const fullPath = path.resolve(process.cwd(), filePath)
            const dir = path.dirname(fullPath)

            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true })
            }

            fs.writeFileSync(fullPath, content, "utf-8")

            console.log(`[level-writer] saved ${filePath}`)

            res.statusCode = 200
            res.end(JSON.stringify({ success: true }))

          } catch (e) {
            console.error(e)
            res.statusCode = 500
            res.end(JSON.stringify({ error: e.message }))
          }
        })
      })

      // Endpoint for publishing levels to src files
      server.middlewares.use("/__publish_level__", async (req, res) => {

        if (req.method !== "POST") {
          res.statusCode = 405
          res.end("Method not allowed")
          return
        }

        let body = ""
        req.on("data", chunk => {
          body += chunk.toString()
        })

        req.on("end", async () => {
          try {

            const { levelId, levelData } = JSON.parse(body)

            const safeFileName = levelId.replace(/[^a-zA-Z0-9_-]/g, "_")

            const filePath = `src/levels/${safeFileName}.js`
            const fullPath = path.resolve(process.cwd(), filePath)

            const dir = path.dirname(fullPath)

            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true })
            }

            const exportName = safeFileName.replace(/-/g, "_") + "Level"

            const jsContent = `export const ${exportName} = ${JSON.stringify(levelData, null, 2)}
`

            fs.writeFileSync(fullPath, jsContent)

            await updateLevelIndex(levelId, safeFileName, exportName)

            res.statusCode = 200
            res.end(JSON.stringify({ success: true }))

          } catch (e) {
            console.error(e)
            res.statusCode = 500
            res.end(JSON.stringify({ error: e.message }))
          }

        })

      })

    }
  }
}


/**
 * update src/levels/index.js
 */
async function updateLevelIndex(levelId, fileName, exportName) {

  const indexPath = path.resolve(process.cwd(), "src/levels/index.js")

  let content = ""

  if (fs.existsSync(indexPath)) {
    content = fs.readFileSync(indexPath, "utf-8")
  }

  const importLine = `import { ${exportName} } from './${fileName}.js'`
  const dataLine = `"${levelId}": ${exportName},`

  if (!content.includes(importLine)) {

    content =
`${importLine}
${content}`

  }

  if (!content.includes(dataLine)) {

    content = content.replace(
      "export const LEVEL_DATA = {",
`export const LEVEL_DATA = {
  ${dataLine}`
    )

  }

  fs.writeFileSync(indexPath, content)

}



/**
 * Vite config for production hosting
 */
export default defineConfig({

  base: "/",

  build: {
    outDir: "dist",
    emptyOutDir: true
  },

  server: {
    host: "0.0.0.0",
    port: 5173
  },

  plugins: [
    levelFileWriterPlugin()
  ]

})
