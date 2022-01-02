export class OperationsDocsHelper {
  static QUERY_GetAll = () =>
    `query MyQuery {
    notes_notes {
      creation_time
      deadline
      id
      note_details
      note_title
      status
      number
    }
  }
`;
  static MUTATION_InsertOne = (title, status) => `mutation MyMutation {
        insert_notes_notes(objects: {note_title: "${title}", status: "${status}"}) {
          returning {
            id
            creation_time
            deadline
            note_details
            note_title
            status
            number
          }
        }
      }
      `;

  static MUTATION_DeleteByStatus = () => `
      mutation MyMutation($status:String) {
        delete_notes_notes(where: {status: {_eq: $status}}) {
          returning {
            id
            deadline
            creation_time
            note_details
            note_title
            status
            number
          }
        }
      }`;

  static MUTATION_DeleteByNumber = () => `
      mutation MyMutation($number:Int) {
        delete_notes_notes(where: {number: {_eq: $number}}) {
          returning {
            creation_time
            id
            note_title
            number
            status
          }
        }
      }
      `;
}
