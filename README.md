# Richtext editing with Yjs

Experimental project to explore richtext editing with the [Yjs text type](https://docs.yjs.dev/api/shared-types/y.text).

## Setup

1. Clone the repository
2. Install the dependencies via `bun install`

## Get started

Start the dev server:

```bash
bun dev
```

Build the app for production:

```bash
bun run build
```

Preview the production build locally:

```bash
bun preview
```

## Known errors

* When entering characters and using the arrow keys at the same time sometimes an error `Index or size is negative or greater than the allowed amount` is thrown which crashes the error => I guess the arrow keys need to be handled by the editor and not by the browser.

## Maintenance

Update dependencies:

```bash
bun update
```
