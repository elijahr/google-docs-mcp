import type { FastMCP } from 'fastmcp';
import { UserError } from 'fastmcp';
import { z } from 'zod';
import { getDocsClient } from '../../clients.js';
import { DocumentIdParameter } from '../../types.js';
import * as GDocsHelpers from '../../googleDocsApiHelpers.js';

export function register(server: FastMCP) {
  server.addTool({
    name: 'listTabs',
    description:
      "Lists all tabs in a document with their IDs and hierarchy. Use the returned tab IDs with other tools' tabId parameter to target a specific tab.",
    parameters: DocumentIdParameter.extend({
      includeContent: z
        .boolean()
        .optional()
        .default(false)
        .describe('Whether to include a content summary for each tab (character count).'),
    }),
    execute: async (args, { log }) => {
      const docs = await getDocsClient();
      log.info(`Listing tabs for document: ${args.documentId}`);

      try {
        // Get document with tabs structure
        // The API rejects bare `childTabs` in the field mask — it treats unspecified
        // child fields as a request for all subfields (including comment-related
        // ones) and errors out: "Field mask cannot retrieve comment-specific fields
        // when include_comments is false." Always specify childTabs subfields.
        // Recurse 3 levels deep, which covers any realistic tab nesting.
        const childTabsRecursive =
          'childTabs(tabProperties,childTabs(tabProperties,childTabs(tabProperties)))';
        const res = await docs.documents.get({
          documentId: args.documentId,
          includeTabsContent: args.includeContent,
          fields: args.includeContent
            ? `title,tabs(tabProperties,${childTabsRecursive},documentTab(body(content(paragraph(elements(startIndex,endIndex,textRun(content))),table,sectionBreak,startIndex,endIndex))))`
            : `title,tabs(tabProperties,${childTabsRecursive})`,
        });

        const docTitle = res.data.title || 'Untitled Document';

        // Get all tabs in a flat list with hierarchy info
        const allTabs = GDocsHelpers.getAllTabs(res.data);

        const tabs = allTabs.map((tab: GDocsHelpers.TabWithLevel) => {
          const tabProperties = tab.tabProperties || {};
          const tabObj: Record<string, any> = {
            id: tabProperties.tabId || null,
            title: tabProperties.title || null,
            index: tabProperties.index ?? null,
          };
          if (tabProperties.parentTabId) {
            tabObj.parentTabId = tabProperties.parentTabId;
          }
          if (args.includeContent && tab.documentTab) {
            tabObj.characterCount = GDocsHelpers.getTabTextLength(tab.documentTab);
          }
          return tabObj;
        });

        return JSON.stringify({ documentTitle: docTitle, tabs }, null, 2);
      } catch (error: any) {
        log.error(`Error listing tabs for doc ${args.documentId}: ${error.message || error}`);
        if (error.code === 404) throw new UserError(`Document not found (ID: ${args.documentId}).`);
        if (error.code === 403)
          throw new UserError(`Permission denied for document (ID: ${args.documentId}).`);
        throw new UserError(`Failed to list tabs: ${error.message || 'Unknown error'}`);
      }
    },
  });
}
