module.exports = (sequelize, DataTypes) => {
    const FirebaseToken = sequelize.define(
      'FirebaseToken',
      {
        id: { 
          type: DataTypes.INTEGER, 
          primaryKey: true, 
          autoIncrement: true 
        },
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'Users',  // This references the Users table
            key: 'id'
          },
          onDelete: 'CASCADE',  // Optionally delete FCM tokens when a user is deleted
        },
        device_id: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,  // Ensure that each device has a unique ID
        },
        fcm_token: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,  // Ensure each token is unique
        },
        platform: {
          type: DataTypes.ENUM('android', 'ios'),
          allowNull: false,
        },
        created_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,  // Automatically set the creation timestamp
        },
        updated_at: {
          type: DataTypes.DATE,
          defaultValue: DataTypes.NOW,  // Automatically set the update timestamp
        },
      },
      {
        tableName: 'firebase_tokens',  // Table name
        timestamps: false,  // We'll manually manage timestamps
      }
    );
  
    return FirebaseToken;
  };
  