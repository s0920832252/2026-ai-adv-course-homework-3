const fs = require('fs');
const path = require('path');

const openapiPath = path.join(__dirname, '..', 'openapi.json');
const outputPath = path.join(__dirname, '..', 'postman_collection.json');
const spec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
const sample = schema => {
  if (!schema) return {};
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum) return schema.enum[0];
  if (schema.type === 'object') return Object.fromEntries(Object.entries(schema.properties || {}).map(([k, v]) => [k, sample(v)]));
  if (schema.type === 'array') return [sample(schema.items)];
  if (schema.type === 'integer' || schema.type === 'number') return schema.minimum || 1;
  if (schema.type === 'boolean') return false;
  return schema.format === 'email' ? 'user@example.com' : 'string';
};
const resolveSchema = schema => {
  if (schema?.$ref) {
    const [, , , component, name] = schema.$ref.split('/');
    return spec.components?.[component]?.[name] || {};
  }
  return schema || {};
};
const pathVariables = route => [...route.matchAll(/\{([^}]+)\}/g)].map(match => ({ key: match[1], value: `{{${match[1]}}}` }));
const items = [];
for (const [route, methods] of Object.entries(spec.paths || {})) {
  for (const [method, operation] of Object.entries(methods)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
    const hasBody = Boolean(operation.requestBody);
    const content = operation.requestBody?.content || {};
    const mediaType = content['application/json'] ? 'application/json' : Object.keys(content)[0];
    let body;
    if (hasBody && mediaType) {
      const schema = resolveSchema(content[mediaType].schema);
      body = { mode: 'raw', raw: JSON.stringify(sample(schema), null, 2), options: { raw: { language: 'json' } } };
    }
    const name = operation.summary || `${method.toUpperCase()} ${route}`;
    const request = {
      method: method.toUpperCase(),
      header: hasBody && mediaType === 'application/json' ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      url: { raw: `{{baseUrl}}${route.replace(/\{([^}]+)\}/g, ':$1')}`, host: ['{{baseUrl}}'], path: route.split('/').filter(Boolean).map(part => part.replace(/^\{(.+)\}$/, ':$1')), variable: pathVariables(route) }
    };
    if (body) request.body = body;
    const authIsRequired = Boolean(operation.security?.length);
    const example = { name, request, response: [] };
    if (route.endsWith('/api/auth/login') || route === '/api/auth/login') {
      request.auth = { type: 'noauth' };
      example.event = [{ listen: 'test', script: { type: 'text/javascript', exec: [
        "const data = pm.response.json();",
        "if (data?.data?.token) pm.collectionVariables.set('token', data.data.token);"
      ] } }];
    } else if (authIsRequired) {
      request.auth = { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] };
    } else {
      request.auth = { type: 'noauth' };
    }
    items.push(example);
  }
}

const collection = {
  info: { name: `${spec.info?.title || 'API'} Collection`, description: '由專案 OpenAPI 文件產生。執行登入請求後會自動保存 JWT。', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3001', type: 'string' },
    { key: 'token', value: '', type: 'string' },
    { key: 'sessionId', value: '', type: 'string' }
  ],
  item: items
};
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2) + '\n');
JSON.parse(fs.readFileSync(outputPath, 'utf8'));
console.log(`Postman collection generated: ${outputPath}`);
