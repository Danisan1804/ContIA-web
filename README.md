# ContIA

proyecto alojado en la URL:
```text
https://asesia-contable.vercel.app
```

ContIA es una interfaz web para consultar dudas de contabilidad y finanzas, con especial atención al contexto colombiano. La aplicación utiliza una función serverless para enviar las conversaciones a Gemini sin exponer la clave de API en el navegador.

## Cómo funciona

1. Escribo una pregunta en la interfaz.
2. El navegador conserva temporalmente el historial en `localStorage`.
3. El navegador envía el historial a `/api/chat`.
4. La función serverless valida el método, el origen, el tamaño del historial y el contenido de los mensajes.
5. La función consulta Gemini usando `GEMINI_API_KEY`, configurada únicamente en Vercel.
6. La respuesta vuelve al navegador y se muestra con un formato básico.

## Estructura

```text
asesia-contable/
├── api/chat.js       # Función serverless que consulta Gemini
├── index.html        # Interfaz, estilos y lógica del cliente
├── vercel.json       # Rutas y encabezados de seguridad
├── .env.example      # Variables esperadas, sin secretos
├── .gitignore
└── README.md
```

## Variables de entorno

La aplicación necesita `GEMINI_API_KEY`. La clave no se escribe en `index.html`, `api/chat.js`, `vercel.json` ni en el repositorio. En Vercel la configuro en **Project Settings → Environment Variables**.

Opcionalmente puedo definir orígenes autorizados separados por comas:

```text
ALLOWED_ORIGINS=https://mi-dominio.com,https://mi-proyecto.vercel.app
```

## Publicar en Vercel

1. Importo este repositorio en Vercel o conecto el repositorio existente.
2. Selecciono como raíz la carpeta donde están `index.html`, `api/` y `vercel.json`.
3. Creo `GEMINI_API_KEY` en Vercel sin pegarla en ningún archivo.
4. Si uso un dominio propio, agrego su origen en `ALLOWED_ORIGINS`.
5. Despliego y pruebo una pregunta desde el navegador.

No necesito un comando de build porque la interfaz es HTML estático y la API se ejecuta como función serverless.

## Seguridad y privacidad

- La clave de Gemini permanece en el servidor de Vercel.
- La API solo acepta `POST` para generar respuestas y `OPTIONS` para preflight.
- Se limita el número aproximado de solicitudes por IP dentro de una instancia de la función.
- Se limita la cantidad de mensajes y caracteres enviados en cada consulta.
- Se restringen los orígenes cross-origin mediante `ALLOWED_ORIGINS`.
- Se escapan los textos antes de insertarlos en la interfaz.
- Las conversaciones se guardan en el navegador del usuario, no en una base de datos del proyecto.

No debo introducir contraseñas, números completos de tarjetas, credenciales bancarias ni datos personales innecesarios. El historial local puede borrarse desde **Limpiar** o eliminando los datos del sitio del navegador.

El límite en memoria ayuda a reducir abusos, pero para tráfico importante debo añadir cuotas persistentes o un WAF de Vercel.

## Limitaciones

- Las respuestas son orientativas y deben verificarse con un contador o asesor certificado cuando la decisión tenga consecuencias legales, fiscales o financieras.
- La disponibilidad de los modelos depende de Gemini.
- El historial depende del navegador y puede perderse al borrar los datos del sitio.
- No hay cuentas de usuario ni sincronización entre dispositivos.

## Desarrollo local

Con Node.js y la CLI de Vercel puedo probarlo así:

```bash
npm install -g vercel
vercel dev
```

La clave se configura localmente sin subir el archivo `.env`.
