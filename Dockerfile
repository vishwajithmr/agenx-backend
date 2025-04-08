# Use the official Node.js image as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package.json package-lock.json ./

# Install dependencies, including devDependencies for the build process
RUN npm install

# Install TypeScript globally to ensure `tsc` is available
RUN npm install -g typescript

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Expose the application port
EXPOSE 9000

# Start the application
CMD ["npm", "start"]
