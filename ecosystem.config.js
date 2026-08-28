module.exports = {
  apps: [{
    name: "request-logger",
    script: "./server.js",
    cwd: "/home/user/GitRepos/request-logger",
    instances: 1,
    exec_mode: "fork"
  }]
}
