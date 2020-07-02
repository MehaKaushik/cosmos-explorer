// 1. Click on "New Graph" on the command bar.
// 2. Pane with the title "Add Container" should appear on the right side of the screen
// 3. It includes an input box for the database Id.
// 4. It includes a checkbox called "Create now".
// 5. When the checkbox is marked, enter new database id.
// 3. Create a database WITH "Provision throughput" checked.
// 4. Enter minimum throughput value of 400.
// 5. Enter container id to the container id text box.
// 6. Enter partition key to the partition key text box.
// 7. Click "OK" to create a new container.
// 8. Verify the new container is created along with the database id and should appead in the Data Explorer list in the left side of the screen.

const connectionString = require("../../../utilities/connectionString");

let crypt = require("crypto");

context("Graph API Test", () => {
  beforeEach(() => {
    connectionString.loginUsingConnectionString(connectionString.constants.graph);
  });

  it("Create a new graph in Graph API", () => {
    const dbId = `TestDatabase${crypt.randomBytes(8).toString("hex")}`;
    const graphId = `TestGraph${crypt.randomBytes(8).toString("hex")}`;
    const partitionKey = `SharedKey${crypt.randomBytes(8).toString("hex")}`;

    cy.get("iframe").then(($element) => {
      const $body = $element.contents().find("body");
      cy.wrap($body)
        .find('div[class="commandBarContainer"]')
        .should("be.visible")
        .find('button[data-test="New Graph"]')
        .should("be.visible")
        .click();

      cy.wrap($body).find('div[class="contextual-pane-in"]').should("be.visible").find('span[id="containerTitle"]');

      cy.wrap($body).find('input[data-test="addCollection-createNewDatabase"]').check();

      cy.wrap($body).find('input[data-test="addCollection-newDatabaseId"]').should("be.visible").type(dbId);

      cy.wrap($body).find('input[data-test="addCollectionPane-databaseSharedThroughput"]').check();

      cy.wrap($body).find('input[data-test="databaseThroughputValue"]').should("have.value", "400");

      cy.wrap($body).find('input[data-test="addCollection-collectionId"]').type(graphId);

      cy.wrap($body).find('input[data-test="addCollection-partitionKeyValue"]').type(partitionKey);

      cy.wrap($body).find('input[data-test="addCollection-createCollection"]').click();

      cy.wait(10000);

      cy.wrap($body)
        .find('div[data-test="resourceTreeId"]')
        .should("exist")
        .find('div[class="treeComponent dataResourceTree"]')
        .should("contain", dbId)
        .click()
        .should("contain", graphId);
    });
  });
});
