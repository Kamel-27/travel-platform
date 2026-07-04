FROM node:22-alpine

WORKDIR /app

# Install full deps (incl. devDependencies) — kept in the runtime image
# deliberately: `npm run migration:run` shells out to typeorm-ts-node-commonjs,
# which needs ts-node/typescript at runtime. Single low-traffic portfolio VM,
# not optimizing image size here.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001

CMD ["sh", "-c", "npm run migration:run && npm run start:prod"]
