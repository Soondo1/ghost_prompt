# Privacy Policy for Prompt Ghost

**Last Updated:** June 17, 2026

Prompt Ghost is committed to protecting your privacy. This Privacy Policy explains how our Chrome Extension collects, uses, and handles your information.

## 1. Information We Collect
Prompt Ghost is designed to help you optimize and transform prompts on LLM (Large Language Model) platforms. To provide this service, the extension accesses the text inputs (prompts) you type into LLM textareas and sends them to your configured Prompt Ghost backend server.

- **Prompt Data:** The raw text inputs you type are sent to your designated Prompt Ghost server for optimization.
- **Authentication Credentials:** The extension securely stores your backend login tokens (JWT) in local storage (`chrome.storage.local`) to authenticate requests.
- **Usage Metrics:** The extension tracks the number of optimizations and acceptances to enforce daily limits and show you your usage statistics.

We **do not** collect, store, or transmit any personal identification information (such as your real name, physical address, or phone number) to any third parties.

## 2. How Information is Used
- **Prompt Optimization:** We process prompt text to generate optimized variations using the configured AI models (such as Google Gemini).
- **Authentication:** Tokens are used strictly to communicate securely with your API.
- **Telemetry:** User acceptance logs (`was_accepted` flag) are reported to compile usage reports and improve the suggestions quality.

## 3. Data Storage and Retention
- Prompt text is cached on your database server to speed up duplicate requests. Capped cache records expire after 24 hours.
- Prompt history is stored under your user account in the database for access in your History tab. You can delete or clear history as needed.

## 4. Third-Party Services
Our extension communicates with your custom API server. Depending on your backend configuration, your server communicates with:
- **Supabase:** For database persistence and authentication.
- **Google Gemini API:** For generating prompt optimization suggestions.

These services have their own privacy policies. We encourage you to review them.

## 5. Security
We take security seriously. All network communication between the extension and the server is encrypted over HTTPS.

## 6. Contact Us
If you have any questions or feedback about this Privacy Policy, please contact the repository administrator.
