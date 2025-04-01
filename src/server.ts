import app from './app';

const PORT: number = parseInt(process.env.PORT as string, 10) || 3000;

app.listen(PORT, (): void => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
});
