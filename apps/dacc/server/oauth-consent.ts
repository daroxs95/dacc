import {html} from 'hono/html';
import type {ConsentDescription} from '@cloudflare/workers-oauth-provider';
import type {User} from './auth';

export const MCP_SCOPE = 'dacc:account';
export const MCP_SCOPES = [MCP_SCOPE, 'offline_access'];

export function consentSecurityHeaders(redirectUri: string) {
    const redirect = new URL(redirectUri);
    // The provider already validates the registered redirect. Limit the CSP source to
    // its origin, and refuse characters that could introduce another CSP directive.
    if (!['https:', 'http:'].includes(redirect.protocol) || !/^[a-zA-Z0-9.:[\]-]+$/.test(redirect.host)) {
        throw new Error('Invalid consent redirect origin.');
    }
    return {
        // no-referrer turns native form POST Origin into "null" in browsers.
        // strict-origin preserves Origin without leaking OAuth query parameters.
        'Referrer-Policy': 'strict-origin',
        'X-Frame-Options': 'DENY',
        // Chrome also applies form-action to the redirect after a successful POST.
        'Content-Security-Policy': `default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; form-action 'self' ${redirect.origin}; frame-ancestors 'none'; base-uri 'none'`,
    };
}

// Reuse the built app's shared decss stylesheet without hardcoding hashed filenames.
export function appStylesheets(index: string) {
    return [...index.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="(\/assets\/[a-zA-Z0-9_.-]+\.css)"[^>]*>/g)]
        .map(match => match[1]);
}

export async function consentPage(details: ConsentDescription, stylesheets: string[], options: {
    user?: User; handle?: string; loginUrl: string;
}) {
    // hono/html escapes all client-controlled strings, including names and domains.
    return String(await html`<!doctype html><html lang="en"><head>
        <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Connect to DACC</title>
        ${stylesheets.map(href => html`<link rel="stylesheet" href="${href}">`)}
        <style>
            body { font-family: Helvetica, Arial, sans-serif; background: #fff; }
            .oauth-header { padding: 1.5rem 2rem; }
            .oauth-card { width: min(100%, 30rem); margin: 3rem auto; padding: 1.5rem; box-sizing: border-box; }
            .oauth-card h1 { font-size: 1.65rem; line-height: 1.3; margin-bottom: 1.5rem; }
            .oauth-card p, .oauth-card ul { margin-bottom: 1.25rem; line-height: 1.6; overflow-wrap: anywhere; }
            .oauth-card ul { padding-left: 1.25rem; }
            .oauth-card form { display: flex; gap: .75rem; flex-wrap: wrap; }
            .oauth-card .identity { border-block: 1px solid var(--form-element-border); padding-block: 1rem; }
            @media(max-width: 600px) { .oauth-header { padding: 1rem; } .oauth-card { margin: 1rem auto; } }
        </style>
    </head><body>
        <header class="oauth-header"><a class="workspace-brand" href="/" aria-label="DACC"><span class="workspace-monogram" aria-hidden="true">d.</span>DACC</a></header>
        <main class="oauth-card">
            <h1>Connect ${details.clientName} to DACC</h1>
            <p>${details.clientDomain ? html`Published by <strong>${details.clientDomain}</strong>.` : 'This app’s name is supplied by its developer.'}
                Access will be returned to <strong>${details.redirectHost}</strong>.</p>
            ${details.redirectIsLoopback ? html`<p>This connects an app on your computer. Continue only if you started this connection.</p>` : ''}
            <p>This connection allows the app to:</p>
            <ul><li>Read your invoices, profiles, and payment summaries.</li><li>Create and update invoices and profiles, and import invoice data.</li>
                ${details.scope.includes('offline_access') ? html`<li>Keep access when you are away using renewable tokens.</li>` : ''}</ul>
            ${options.user ? html`
                <p class="identity">Signed in as <strong>${options.user.email}</strong></p>
                <form method="post" action="/oauth/authorize">
                    <input type="hidden" name="handle" value="${options.handle}">
                    <input type="hidden" name="account" value="${options.user.id}">
                    <button name="decision" value="approve">Allow access</button>
                    <button class="secondary" name="decision" value="deny">Cancel</button>
                </form>
            ` : html`<p>Sign in to choose the DACC account to connect. You will approve access on the next screen.</p>
                <a class="button secondary" href="${options.loginUrl}">Continue with Google</a>`}
        </main>
    </body></html>`);
}
