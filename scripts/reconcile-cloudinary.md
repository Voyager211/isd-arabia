# Cloudinary orphan reconciliation

`PROJECT_PLAN.md` §13.4.

Soft-deleting a product deliberately does **not** destroy its Cloudinary
assets — the action is reversible, and destroying the images would make it
irreversible in the one way that matters. The cost is that assets accumulate
for records that will never be restored.

This is a manual, occasional job rather than an automated one, and that is
deliberate: a script that deletes assets it believes are unreferenced is one
query bug away from wiping the live catalogue's images.

## Procedure

1. Export every `publicId` currently referenced in the database:

   ```js
   // mongosh against the production database
   const referenced = new Set();

   db.products.find({}, { images: 1, documents: 1 }).forEach((p) => {
     (p.images ?? []).forEach((i) => referenced.add(i.publicId));
     (p.documents ?? []).forEach((d) => referenced.add(d.publicId));
   });

   for (const c of ['categories', 'brands', 'industries']) {
     db[c].find({}, { image: 1, banner: 1, logo: 1, icon: 1 }).forEach((doc) => {
       ['image', 'banner', 'logo', 'icon'].forEach((k) => {
         if (doc[k]?.publicId) referenced.add(doc[k].publicId);
       });
     });
   }

   db.cataloguefiles.find({}, { file: 1, coverImage: 1 }).forEach((f) => {
     if (f.file?.publicId) referenced.add(f.file.publicId);
     if (f.coverImage?.publicId) referenced.add(f.coverImage.publicId);
   });

   print([...referenced].join('\n'));
   ```

   Note this includes soft-deleted records on purpose — their assets are not
   orphans, they are pending a possible restore.

2. List everything under the project folder in the Cloudinary Media Library.

3. Diff the two. **Review the difference by hand before deleting anything.**

4. Delete the confirmed orphans through the Media Library UI.

## Before you run this

- Take a database backup first (`scripts/backup-mongo.sh`).
- Never delete an asset uploaded in the last 7 days: a product part-way through
  being entered has images in Cloudinary and no database record yet.
