var http = require('http');
var fs = require('fs');
var qs = require('querystring');

const config = require('./config/config.json');
const defaultConfig = config.development;
global.gConfig = defaultConfig;

function requestBackend(path, method, bodyData) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: global.gConfig.webservice_host,
      port: global.gConfig.webservice_port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };

    const backendReq = http.request(options, (backendRes) => {
      let data = '';

      backendRes.on('data', (chunk) => {
        data += chunk;
      });

      backendRes.on('end', () => {
        resolve({
          statusCode: backendRes.statusCode,
          body: data
        });
      });
    });

    backendReq.on('error', (err) => {
      reject(err);
    });

    backendReq.on('timeout', () => {
      backendReq.destroy(new Error('Backend request timed out'));
    });

    if (bodyData) {
      backendReq.write(JSON.stringify(bodyData));
    }

    backendReq.end();
  });
}

function renderPage(message, recipes, backendStatus) {
  const css = fs.readFileSync('./public/default.css', { encoding: 'utf8' });

  let recipeRows = '';

  if (recipes && recipes.length > 0) {
    recipeRows = recipes.map(function (recipe) {
      return `
        <tr>
          <td>${recipe.name || ''}</td>
          <td>${Array.isArray(recipe.ingredients) ? recipe.ingredients.join(', ') : recipe.ingredients || ''}</td>
          <td>${recipe.prepTimeInMinutes || ''} mins</td>
        </tr>
      `;
    }).join('');
  } else {
    recipeRows = `
      <tr>
        <td colspan="3">No recipes found yet.</td>
      </tr>
    `;
  }

  return `
<!doctype html>
<html>
<head>
  <title>${global.gConfig.app_name}</title>
  <style>
    ${css}

    .status-box {
      display: block;
      margin: 20px auto;
      width: 500px;
      padding: 12px;
      font-size: 15px;
      font-family: Helvetica;
      text-align: center;
      border-radius: 6px;
      background: #ffffff;
      border: 1px solid #ddd;
    }

    .status-ok {
      color: #1b7f37;
      font-weight: bold;
    }

    .status-error {
      color: #d93025;
      font-weight: bold;
    }

    .message {
      display: block;
      margin: 20px auto;
      width: 500px;
      padding: 12px;
      font-size: 16px;
      font-family: Helvetica;
      text-align: center;
      background: #eef7ee;
      border: 1px solid #4CAF50;
      border-radius: 6px;
    }

    table {
      margin: 20px auto;
      border-collapse: collapse;
      width: 750px;
      font-family: Helvetica;
      background: white;
    }

    th, td {
      border: 1px solid #ccc;
      padding: 10px;
      text-align: center;
      font-size: 15px;
    }

    th {
      background: #f44336;
      color: white;
    }

    .small-button {
      padding: 10px 18px;
      font-size: 14px;
      width: 180px;
    }
  </style>
</head>

<body>
  <div id="container">
    <div id="logo">${global.gConfig.app_name}</div>

    <div class="status-box">
      Backend Service:
      ${
        backendStatus
          ? '<span class="status-ok">Connected</span>'
          : '<span class="status-error">Unavailable</span>'
      }
      <br/>
      Frontend Port: ${global.gConfig.exposedPort}
      <br/>
      Backend Target: ${global.gConfig.webservice_host}:${global.gConfig.webservice_port}
    </div>

    ${message ? `<div class="message">${message}</div>` : ''}

    <div id="form">
      <form action="/" method="post">
        <center>
          <label class="control-label">Name:</label>
          <input class="input" type="text" name="name" required /><br />

          <label class="control-label">Ingredients:</label>
          <input class="input" type="text" name="ingredients" placeholder="rice,chicken,spices" required /><br />

          <label class="control-label">Prep Time:</label>
          <input class="input" type="number" name="prepTimeInMinutes" required /><br />

          <button class="button button1">Submit Recipe</button>
        </center>
      </form>
    </div>

    <div id="results">
      <h3>Your Previous Recipes</h3>

      <form action="/" method="get">
        <button class="button button1 small-button">Refresh Recipes</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Ingredients</th>
            <th>Prep Time</th>
          </tr>
        </thead>
        <tbody>
          ${recipeRows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
`;
}

async function getRecipes() {
  try {
    const response = await requestBackend('/recipes', 'GET');

    if (!response.body) {
      return {
        backendStatus: true,
        recipes: []
      };
    }

    return {
      backendStatus: true,
      recipes: JSON.parse(response.body)
    };
  } catch (err) {
    console.error('Error loading recipes:', err.message);
    return {
      backendStatus: false,
      recipes: []
    };
  }
}

async function saveRecipe(postData) {
  const recipe = {
    name: postData.name,
    ingredients: postData.ingredients ? postData.ingredients.split(',').map(i => i.trim()) : [],
    prepTimeInMinutes: postData.prepTimeInMinutes
  };

  await requestBackend('/recipe', 'POST', recipe);
}

http.createServer(async function (req, res) {
  console.log(req.method + ' ' + req.url);

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  let message = '';

  if (req.method === 'POST') {
    let body = '';

    req.on('data', function (chunk) {
      body += chunk.toString();
    });

    req.on('end', async function () {
      try {
        const postData = qs.parse(body);
        await saveRecipe(postData);
        message = 'New recipe saved successfully!';
      } catch (err) {
        console.error('Error saving recipe:', err.message);
        message = 'Recipe could not be saved. Backend service may be unavailable.';
      }

      const result = await getRecipes();
      const page = renderPage(message, result.recipes, result.backendStatus);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(page);
    });

    return;
  }

  const result = await getRecipes();
  const page = renderPage(message, result.recipes, result.backendStatus);

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(page);

}).listen(global.gConfig.exposedPort, '0.0.0.0', function () {
  console.log(
    `${global.gConfig.app_name} frontend running on port ${global.gConfig.exposedPort}`
  );
});