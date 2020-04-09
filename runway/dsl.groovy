import utilities.GogoUtilities

SHELL_STEPS=sprintf('''
  npm update
  npm install --production
  cp -R node_modules src/
  ''', ['JOB_NAME'])

// API docs: https://jenkinsci.github.io/job-dsl-plugin/
def myJob = job("$SRC_JOB") {
  parameters {
    stringParam('GIT_BUILD_BRANCH', 'master', 'Git branch used to build.')
  }

  description('Simple POC lambda to attempt to download artifacts from Artifactory')
  
  logRotator {
    numToKeep(5)
    artifactNumToKeep(5)
  }

  scm {
    git {
      remote {
        url("$REPO")
        credentials('gitlab-jenkinsci')
      }
      branch('$GIT_BUILD_BRANCH')
    }
  }

  wrappers {
    preBuildCleanup()
  }

  triggers {
    scm('* * * * *')
  }

  steps {
    shell(SHELL_STEPS)
  }

}

g = new GogoUtilities(job: myJob)
g.addBaseOptions(artifact_type='lambda')
g.setupNodeEnvironment('12')
g.addColorOutput()