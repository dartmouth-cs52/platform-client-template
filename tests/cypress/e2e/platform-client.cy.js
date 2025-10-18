const buildInitialPostDetails = () => ({
  'post-1': {
    id: 'post-1',
    title: 'Avocado Toast',
    tags: ['brunch', 'quick'],
    coverUrl: 'https://example.com/avocado.jpg',
    ingredients: ['Bread', 'Avocado', 'Olive Oil'],
    instructions: 'Toast bread, mash avocado, assemble and enjoy.',
  },
  'post-2': {
    id: 'post-2',
    title: 'Berry Smoothie',
    tags: ['breakfast', 'drink'],
    coverUrl: 'https://example.com/smoothie.jpg',
    ingredients: ['Berries', 'Yogurt', 'Ice'],
    instructions: 'Blend everything until smooth.',
  },
});

const deriveListFromDetails = (details) => {
  return Object.values(details).map(({ id, title, tags, coverUrl }) => ({
    id,
    title,
    tags,
    coverUrl,
  }));
};

describe('Lab4 Platform Client', () => {
  let postDetails;
  let listPayload;

  beforeEach(() => {
    postDetails = buildInitialPostDetails();
    listPayload = deriveListFromDetails(postDetails);

    cy.intercept('GET', '**/api/posts?*', (req) => {
      req.reply({ statusCode: 200, body: listPayload });
    }).as('fetchAllPosts');

    cy.intercept('GET', '**/api/posts/*', (req) => {
      const match = req.url.match(/\/api\/posts\/([^/?]+)/);
      const id = match ? match[1] : '';
      const payload = postDetails[id];
      if (!payload) {
        req.reply({ statusCode: 404, body: {} });
        return;
      }
      req.reply({ statusCode: 200, body: payload });
    }).as('fetchPost');

    cy.visit('/');
    cy.wait('@fetchAllPosts');
  });

  it('renders posts returned from the API and shows their tags', () => {
    cy.get('.post-container').should('have.length', listPayload.length);
    listPayload.forEach((post) => {
      cy.contains('h2.post-title', post.title).should('be.visible');
      post.tags.forEach((tag) => {
        cy.contains('.post-tag', tag).should('be.visible');
      });
    });
  });

  it('allows viewing and editing a post, persisting the updated data', () => {
    let updatedDetail;

    cy.intercept('PUT', '**/api/posts/post-1*', (req) => {
      const updatedTags = Array.isArray(req.body.tags) ? req.body.tags : `${req.body.tags}`.split(/[,\s]+/).filter(Boolean);
      const updatedIngredients = Array.isArray(req.body.ingredients)
        ? req.body.ingredients
        : `${req.body.ingredients}`.split(',').map((value) => value.trim()).filter(Boolean);

      updatedDetail = {
        ...postDetails['post-1'],
        title: req.body.title,
        tags: updatedTags,
        coverUrl: req.body.coverUrl,
        ingredients: updatedIngredients,
        instructions: req.body.instructions,
      };

      postDetails['post-1'] = updatedDetail;
      listPayload = listPayload.map((post) => {
        if (post.id === 'post-1') {
          return {
            ...post,
            title: updatedDetail.title,
            coverUrl: updatedDetail.coverUrl,
            tags: updatedDetail.tags,
          };
        }
        return post;
      });

      req.reply({ statusCode: 200, body: updatedDetail });
    }).as('updatePost');

    cy.contains('.post-container a', postDetails['post-1'].title).click();
    cy.wait('@fetchPost');

    cy.contains('button', 'Edit').click();
    cy.get('input#title').clear().type('Midnight Avocado Toast');
    cy.get('input#tags').clear().type('late-night comfort');
    cy.get('textarea#ingredients').clear().type('Bread, Avocado, Chili Flakes');
    cy.get('textarea#instructions').clear().type('Toast bread, mash avocado, top with chili flakes.');
    cy.get('input#coverImageUrl').clear().type('https://example.com/midnight-toast.jpg');

    cy.contains('button', 'Save Changes').click();
    cy.wait('@updatePost');
    cy.wait('@fetchPost');

    cy.contains('h1', 'Midnight Avocado Toast').should('be.visible');
    cy.contains('.post-tag', 'late-night').should('be.visible');
    cy.contains('.ingredients p', 'Chili Flakes').should('be.visible');
  });

  it('validates the new post form and adds a post when submission succeeds', () => {
    cy.intercept('POST', '**/api/posts*', (req) => {
      const slug = `post-${Date.now()}`;
      const normalizedTags = `${req.body.tags}`.split(/[,\s]+/).filter(Boolean);
      const normalizedIngredients = `${req.body.ingredients}`.split(',').map((value) => value.trim()).filter(Boolean);

      const detail = {
        id: slug,
        title: req.body.title,
        tags: normalizedTags,
        coverUrl: req.body.coverUrl,
        ingredients: normalizedIngredients,
        instructions: req.body.instructions,
      };

      postDetails[slug] = detail;
      listPayload = [...listPayload, {
        id: slug,
        title: detail.title,
        tags: detail.tags,
        coverUrl: detail.coverUrl,
      }];

      req.reply({ statusCode: 200, body: { id: slug } });
    }).as('createPost');

    cy.contains('button', 'New Recipe').click({ force: true });

    cy.contains('button', 'Save Recipe').click();
    cy.get('input#title:invalid').should('have.length', 1);

    cy.get('input#title').type('Garden Pasta');
    cy.get('input#tags').type('dinner easy');
    cy.get('textarea#ingredients').type('Pasta, Tomatoes, Basil');
    cy.get('textarea#instructions').type('Cook pasta. Toss with tomatoes and basil.');
    cy.get('input#coverImageUrl').type('https://example.com/garden-pasta.jpg');

    cy.contains('button', 'Save Recipe').click();
    cy.wait('@createPost');
    cy.wait('@fetchAllPosts');

    cy.contains('h2.post-title', 'Garden Pasta').should('be.visible');
  });

  it('deletes a post and returns to the list view without it', () => {
    const deletedTitle = postDetails['post-1'].title;

    cy.intercept('DELETE', '**/api/posts/post-1*', (req) => {
      delete postDetails['post-1'];
      listPayload = listPayload.filter((post) => post.id !== 'post-1');
      req.reply({ statusCode: 200, body: {} });
    }).as('deletePost');

    cy.contains('.post-container a', deletedTitle).click();
    cy.wait('@fetchPost');

    cy.contains('button', 'Delete').click();
    cy.wait('@deletePost');
    cy.wait('@fetchAllPosts');

    cy.location('pathname').should('eq', '/');
    cy.contains('h2.post-title', deletedTitle).should('not.exist');
    cy.get('.post-container').should('have.length', 1);
  });
});
