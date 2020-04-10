const fs = require('fs')
const { resolve, join } = require('path')
const axios = require('axios')
var yauzl = require('yauzl')

const landingDir = resolve('/tmp', 'landing')
const lambdaDir = resolve('/tmp', 'zips')
const artifactoryUrl =
  'https://artifactory.build.gogoair.com/artifactory/api/archive/buildArtifacts'

const downloadArtifact = async (repo, artifact) => {
  console.log(
    `Downloading artifact from Artifactory - Repo: "${repo}" Artifact: "${artifact}"`
  )

  const path = resolve(landingDir, 'artifact.zip')
  console.log(`Download path: ${path}`)

  const writer = fs.createWriteStream(path)

  const { username, password } = process.env

  const body = {
    buildName: artifact,
    buildNumber: 'LATEST',
    repos: [repo],
    archiveType: 'zip',
    mappings: [
      {
        input: `${artifact}/(?:.+)/(.+).zip`,
        output: '$1.zip',
      },
    ],
  }

  try {
    const response = await axios({
      url: artifactoryUrl,
      method: 'POST',
      responseType: 'stream',
      data: body,
      auth: {
        username,
        password,
      },
      onDownloadProgress: console.log,
    })

    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Finished downloading artifact to file: "${path}"`)
        resolve(path)
      })
      writer.on('error', reject)
    })
  } catch (e) {
    console.error('Error ocurred while downloading artifact', e)
    throw e
  }
}

const unzipArchiveContainer = async (archivePath, artifact) => {
  console.log(`Opening zip file at "${archivePath}"`)
  yauzl.open(archivePath, { lazyEntries: true }, function (err, zipfile) {
    if (err) {
      console.error('Failed to open file', err)
      throw err
    }
    console.log('Reading entry')
    zipfile.readEntry()
    return new Promise((resolve, reject) => {
      zipfile.on('entry', (entry) => {
        console.log('Entry: ', entry)
        if (/\/$/.test(entry.fileName)) {
          // Directory file names end with '/'.
          // Note that entries for directories themselves are optional.
          // An entry's fileName implicitly requires its parent directories to exist.
          // zipfile.readEntry()
          console.log('dir detected')
          resolve()
        } else {
          // file entry
          // const path = resolve(__dirname, 'a_dashmix_mix059eventworker.zip')
          console.log(__dirname)
          const writePath = join(lambdaDir, `${artifact}.zip`)
          console.log(`Writing artifact "${artifact}" to path "${writePath}"`)
          const writer = fs.createWriteStream(writePath)
          console.log('Streaming entry to file')
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error('Error encountered while streaming entry', err)
              reject(err)
            }
            readStream.on('end', function () {
              console.log('Completed writing file')
              zipfile.readEntry()
              resolve()
            })
            readStream.pipe(writer)
          })
        }
      })
    })
  })
}

const mkdir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }
}

exports.handler = (event, context) => {
  const {
    repo = 'lambda-local',
    artifact = 'a_dashmix_mix059eventworker',
  } = event

  console.log(`Making landing directory: ${landingDir}`)
  mkdir(landingDir)

  console.log(`Making lambda directory: ${lambdaDir}`)
  mkdir(lambdaDir)

  downloadArtifact(repo, artifact)
    .then((path) => unzipArchiveContainer(path, artifact))
    .catch((e) => console.error('Failed to download and prepare artifact', e))
}
