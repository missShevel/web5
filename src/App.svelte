<script>
  import requestRunner from './requests/requests-runner';
  import { OperationsDocsHelper } from './requests/operation-docs-helper';
  import { onMount } from 'svelte';
  import { isAuthenticated, user, notes, token, counter, error } from './store';
  import auth from './auth_service';
  import dayjs from 'dayjs';
  let auth0Client;
  let online;
  const inputValues = {
    add: {},
    delete: {},
  };

  onMount(async () => {
    auth0Client = await auth.createClient();

    isAuthenticated.set(await auth0Client.isAuthenticated());
    user.set(await auth0Client.getUser());
    if (isAuthenticated) {
      const accessToken = await auth0Client.getIdTokenClaims();
      if (accessToken) token.set(accessToken.__raw);
    }
  });

  token.subscribe(async (value) => {
    if (value) {
      const result = await requestRunner.startFetchMyQuery(
        OperationsDocsHelper.QUERY_GetAll(),
      );
      notes.set(result.notes_notes);
    }
  });

  function login() {
    auth.loginWithPopup(auth0Client);
  }

  function logout() {
    auth.logout(auth0Client);
  }

  const addNote = async () => {
    const { title, status } = inputValues.add;
    try {
      const { insert_notes_notes } = await requestRunner.startExecuteMyMutation(
        OperationsDocsHelper.MUTATION_InsertOne(title, status),
      );
      notes.update((newNote) => [...newNote, insert_notes_notes.returning[0]]);
    } catch (e) {
      error.set(e.message);
    }
  };

  const deleteNote = async () => {
    const { noteNumber } = inputValues.delete;
    await requestRunner.startExecuteMyMutation(
      OperationsDocsHelper.MUTATION_DeleteByNumber(),
      {
        number: parseInt(noteNumber),
      },
    );
    notes.update((deletedNote) =>
      deletedNote.filter((item) => item.number != noteNumber),
    );
  };
</script>

<svelte:window bind:online />
<main>
  {#if !online}
    <h1>You r offline</h1>
  {:else if $isAuthenticated}
    {#if !$counter}
      <div class="limiter">
        <div class="container-table100">
          <div class="wrap-table100">
            <div class="table">
              <div class="row header">
                <div class="cell">№</div>
                <div class="cell">Title</div>
                <div class="cell">Date</div>
                <div class="cell">Status</div>
              </div>
              {#each $notes as note (note.id)}
                <div class="row">
                  <div class="cell" data-title="Number">
                    {note.number}
                  </div>
                  <div class="cell" data-title="Title">
                    {note.note_title}
                  </div>
                  <div class="cell" data-title="Date">
                    {dayjs(note.creation_time).format('YYYY-DD-MM HH:MM')}
                  </div>
                  <div class="cell" data-title="Status">
                    {note.status}
                  </div>
                </div>
              {/each}
            </div>
            <div class="props">
              <h4>Add Note</h4>
              <p>
                If you want to add new note, please enter it's title and status
              </p>
              <input placeholder="Title" bind:value={inputValues.add.title} />
              <input placeholder="Status" bind:value={inputValues.add.status} />
              <button class="btn" on:click={addNote}>Add Note</button>
            </div>
            <div class="props">
              <h4>Delete Note</h4>
              <p>If you want to delete note, please enter it's number</p>
              <input
                placeholder="Number"
                bind:value={inputValues.delete.noteNumber}
              />
              <button class="btn" on:click={deleteNote}>Delete</button>
            </div>
            <div class="buttons">
              <button class="btn" on:click={logout}>Logout</button>
            </div>
            {#if $error}
              <h2>{$error}</h2>
            {/if}
          </div>
        </div>
      </div>
    {:else}
      <p>is loading...</p>
    {/if}
  {:else}
    <button class="btn" on:click={login}>Login</button>
  {/if}
</main>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap');

  .limiter {
    width: 100%;
    margin: 0 auto;
  }

  h4 {
    font-family: Poppins, sans-serif;
    color: #494949;
    margin: 5px 0;
  }

  p {
    font-family: Poppins, sans-serif;
    font-size: 16px;
    color: #646464;
    line-height: 1.2;
    font-weight: unset !important;
  }

  input {
    line-height: 2;
    border-radius: 10px;
    margin: 7px 0;
    padding: 5px;
    font-family: Poppins, sans-serif;
    font-size: 16px;
  }

  .container-table100 {
    width: 100%;
    min-height: 100vh;
    background: #c4d3f6;

    display: -webkit-box;
    display: -webkit-flex;
    display: -moz-box;
    display: -ms-flexbox;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    padding: 33px 30px;
  }

  .wrap-table100 {
    width: 960px;
    border-radius: 10px;
    overflow: hidden;
  }

  .table {
    width: 100%;
    display: table;
    margin: 0;
  }

  .buttons {
    line-height: 20px;
    margin: 15px;
    display: flex;
    justify-content: center;
  }

  .btn {
    padding: 10px 10px;
    font-family: Poppins;
    font-size: 15px;
    color: #ffffff;
    margin: 10px;
    background-color: #6c7ae0;
    border-radius: 9px;
  }

  @media screen and (max-width: 768px) {
    .table {
      display: block;
    }
  }

  .row {
    display: table-row;
    background: #fff;
  }

  .row.header {
    color: #ffffff;
    background: #6c7ae0;
  }

  @media screen and (max-width: 768px) {
    .row {
      display: block;
    }

    .row.header {
      padding: 0;
      height: 0px;
    }

    .row.header .cell {
      display: none;
    }

    .row .cell:before {
      font-family: Poppins, sans-serif;
      font-size: 12px;
      color: #808080;
      line-height: 1.2;
      text-transform: uppercase;
      font-weight: unset !important;

      margin-bottom: 13px;
      content: attr(data-title);
      min-width: 98px;
      display: block;
    }
  }

  .cell {
    display: table-cell;
  }

  @media screen and (max-width: 768px) {
    .cell {
      display: block;
    }
  }

  .row .cell {
    font-family: Poppins, sans-serif;
    color: #666666;
    line-height: 1.2;
    font-weight: unset !important;

    padding-top: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid #f2f2f2;
  }

  .row.header .cell {
    font-family: Poppins, sans-serif;
    font-size: 18px;
    color: #fff;
    line-height: 1.2;
    font-weight: unset !important;

    padding-top: 19px;
    padding-bottom: 19px;
  }

  .row .cell:nth-child(1) {
    width: 160px;
    padding-left: 40px;
  }

  .row .cell:nth-child(2) {
    width: 360px;
  }

  .row .cell:nth-child(3) {
    width: 300px;
  }

  .row .cell:nth-child(4) {
    width: 140px;
  }

  .table,
  .row {
    width: 100% !important;
  }

  .row:hover {
    background-color: #ececff;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .row {
      border-bottom: 1px solid #f2f2f2;
      padding-bottom: 18px;
      padding-top: 30px;
      padding-right: 15px;
      margin: 0;
    }

    .table,
    .row,
    .cell {
      width: 100% !important;
    }
    .row .cell {
      border: none;
      padding-left: 30px;
      padding-top: 16px;
      padding-bottom: 16px;
      font-family: Poppins, sans-serif;
      font-size: 18px;
      color: #555555;
      line-height: 1.2;
      font-weight: unset !important;
    }

    .row .cell:nth-child(1) {
      padding-left: 30px;
    }
  }
</style>
