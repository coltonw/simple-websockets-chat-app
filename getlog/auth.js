require("dotenv").config({ silent: true });

const jwksClient = require("jwks-rsa");
const jwt = require("jsonwebtoken");
const util = require("util");

const getPolicyDocument = (effect, resource) => {
  const policyDocument = {
    Version: "2012-10-17", // default version
    Statement: [
      {
        Action: "execute-api:Invoke", // default action
        Effect: effect,
        Resource: resource,
      },
    ],
  };
  return policyDocument;
};

const jwtOptions = {
  audience: process.env.AUDIENCE,
  issuer: process.env.TOKEN_ISSUER,
};

module.exports.authenticate = (token) => {
  const decoded = jwt.decode(token, { complete: true });
  console.log(decoded);
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error("invalid token");
  }

  const getSigningKey = util.promisify(client.getSigningKey);
  return getSigningKey(decoded.header.kid).then((key) => {
    const signingKey = key.publicKey || key.rsaPublicKey;
    return jwt.verify(token, signingKey, jwtOptions);
  });
};

const client = jwksClient({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10, // Default value
  jwksUri: process.env.JWKS_URI,
});
