export class StaticController {
  async serveIndex(): Promise<Response> {
    try {
      // In production, this would serve the built React app
      // For now, we'll serve a simple HTML that loads the React app
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mini Notes</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/frontend/main.tsx"></script>
</body>
</html>`;

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Static serve error:', error);
      return new Response('Error serving static files', { status: 500 });
    }
  }
}