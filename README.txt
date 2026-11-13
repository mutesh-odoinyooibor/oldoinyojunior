ElimuHub on Netlify
===================

OPTION 1: Drag and drop (easiest, works from a phone or laptop)
- Go to app.netlify.com/drop
- Drop ONLY index.html (rename the folder if needed, the file must be called index.html)
- Open the link Netlify gives you.
- Data is saved in the browser of the device you use. It does not follow you to another device.
  Use "Download backup" in the Options menu often, and "Restore backup" to move to another device.

OPTION 2: Shared data across all devices (parents and teachers on their own phones)
- Put this whole folder in a GitHub repository (or use the Netlify CLI: netlify deploy --prod).
- Create the Netlify site from that repository. Netlify installs @netlify/blobs and builds netlify/functions/db.mjs.
- Open index.html, find this line near the top of the first <script>:
      var SYNC_URL="";
  and change it to:
      var SYNC_URL="/api/db";
- Redeploy. All devices now share one database.
- Anyone who knows the site address can reach /api/db, so share the link only with school staff and parents.

Admin sign-in: mutesh@oldoinyooibor.edu (password as you set it).
Teachers register in Options > Register teachers and get short scoring emails (no password).
Parents open the Parents room and type the learner's assessment number after you press Publish under Parents.
