import os
import psycopg

from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv()

with psycopg.connect(
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT"),
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD")
) as connector:



    print("Подключение успешно\n")

    print("Выберите действие:")
    print("1 - Войти")
    print("2 - Зарегестрироваться")
    print("3 - Изменить имя")
    print("4 - Удалить аккаунт")

    def update_user(old, new):
        with connector.cursor(row_factory=dict_row) as cursor:
            cursor.execute("UPDATE users SET username=%s WHERE username = %s RETURNING user_id, username" , (new, old))
            user_id = cursor.fetchone()
            connector.commit()
            return user_id


    def find_user(username):
        with connector.cursor(row_factory=dict_row) as cursor:
            cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
            return cursor.fetchone()


    def create_user(mail,name):
        with connector.cursor(row_factory=dict_row) as cursor:
            cursor.execute("INSERT INTO users (email,username) VALUES (%s,%s) RETURNING user_id",(mail,name))
            user_id = cursor.fetchone()
            connector.commit()
            return user_id

    def delete_account(username):
        with connector.cursor(row_factory=dict_row) as cursor:
            cursor.execute("DELETE FROM users WHERE username = %s RETURNING user_id", (username,))
            deleted_name = cursor.fetchone()
            connector.commit()
            return deleted_name

    def login():
        print(f'\nВход\n')
        username= input('Ваш ник: ')

        log = find_user(username)

        if log is not None:
            print(f"Здравствуйте, {log['username']}, ваш id: {log['user_id']}")
        else:
            print('Пользователь не найден')

    def register():
        print('\nРЕГИСТРАЦИЯ\n')
        email = input('Введите вашу почту: ')
        while True:
            name = input('Придумайте ник: ')
            if 3 <= len(name) <= 12:
                break

            print("Никнейм должен быть от 3 до 12 символов")

        try:
            creator = create_user(email,name)
            print(f"Вы зарегистрированы! Ваш id: {creator['user_id']}")

        except psycopg.errors.UniqueViolation:
            connector.rollback()
            print("Такой username или email уже существует")

        except psycopg.errors.CheckViolation:
            connector.rollback()
            print("Данные не прошли проверку")


    def name_editor():
        print(f'\nИзменить имя пользователя\n')
        old = input(f'Введите ваш старый никнейм: ')
        new = input(f'Введите новый никнейм: ')

        try:
            update = update_user(old, new)

            if update is None:
                print("Пользователь с таким никнеймом не найден")
            else:
                print(f"Никнейм {old} изменён на {update['username']}")

        except psycopg.errors.UniqueViolation:
            connector.rollback()
            print("Такой никнейм уже занят")

        except psycopg.errors.CheckViolation:
            connector.rollback()
            print("Некорректный никнейм")

    def delete_user():
        print('\nДеактивация аккаунта\n')
        name = input('Введите ваш никнейм: ')
        while True:
            agree = input('Вы уверены? Введите "пенис" для подтверждения или 1 для отмены: ')
            if agree == 'пенис':
                delete = delete_account(name)
                if delete is not None:
                    print(f"Аккаунт {name} с id {delete['user_id']} успешно удален")
                else:
                    print("Пользователь с таким никнеймом не найден")
                break
            elif agree == '1':
                print("Вы отменили удаление")
                break


    while True:
        try:
            print()
            action = int(input("Введите номер действия: "))

            if action == 1:
                login()
                break

            elif action == 2:
                register()
                break

            elif action == 3:
                name_editor()
                break

            elif action == 4:
                delete_user()
                break

            else:
                print("Такого действия нет.")

        except ValueError:
            print("Ошибка ввода: введите число от 1 до 4")