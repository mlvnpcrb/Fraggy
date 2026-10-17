"""API-only deployment entry point. No scheduler, imports, or filesystem writes."""
import os
import uvicorn


def main():
    port = int(os.getenv('PORT', '8000'))
    if not 1 <= port <= 65535:
        raise ValueError('PORT must be between 1 and 65535')
    uvicorn.run('fraggy.api:app', host='0.0.0.0', port=port, workers=1)


if __name__ == '__main__':
    main()
